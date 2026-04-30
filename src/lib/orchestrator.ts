/**
 * Video Pipeline Orchestrator
 * Coordinates: Face Swap (RunPod) → Audio (local) → Merge → Upload
 */

import { db } from "./db";
import { streamUploadToS3, getPresignedUploadUrl, getPresignedDownloadUrl } from "./s3";
import { submitFaceSwapJob, waitForFaceSwap } from "./runpod";
import { generatePersonalizedAudio, mergeAudioIntoVideo } from "./audio-pipeline";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

interface StepTiming {
  step: string;
  label: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  durationLabel?: string;
}

interface PipelineTimings {
  pipelineStartedAt: string;
  pipelineCompletedAt?: string;
  totalDurationMs?: number;
  totalDurationLabel?: string;
  steps: StepTiming[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function startStep(timings: PipelineTimings, step: string, label: string): StepTiming {
  const entry: StepTiming = {
    step,
    label,
    startedAt: new Date().toISOString(),
  };
  timings.steps.push(entry);
  return entry;
}

function endStep(entry: StepTiming): void {
  entry.completedAt = new Date().toISOString();
  entry.durationMs = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
  entry.durationLabel = formatDuration(entry.durationMs);
}

/**
 * Run the full personalization pipeline for a job
 */
export async function processVideoJob(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { user: true } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const workDir = path.join(os.tmpdir(), `daawat_${jobId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const timings: PipelineTimings = {
    pipelineStartedAt: new Date().toISOString(),
    steps: [],
  };

  try {
    // ─── Step 1: Face Swap via RunPod ────────────────────────────────────
    const step1 = startStep(timings, "face_swapping", "Face Swap");
    await updateJob(jobId, { status: "face_swapping", progress: 10, stepTimings: timings });
    console.log(`\n🎭 Step 1: Face swap for job ${jobId}`);

    const swappedKey = `outputs/swapped_${jobId}.mp4`;
    const uploadUrl = await getPresignedUploadUrl(swappedKey, "video/mp4");

    const sourceUrl = await getPresignedDownloadUrl(job.selfieS3Key);
    const templateUrl = await getPresignedDownloadUrl(process.env.TEMPLATE_VIDEO_S3_KEY || "assets/template.mp4");

    const runpodJob = await submitFaceSwapJob({
      source_url: sourceUrl,
      target_url: templateUrl,
      upload_url: uploadUrl,
      gender: "female",
    });

    await updateJob(jobId, { runpodJobId: runpodJob.id, progress: 20, stepTimings: timings });
    console.log(`  ▸ RunPod job submitted: ${runpodJob.id}`);

    // Poll until complete
    const result = await waitForFaceSwap(runpodJob.id);
    endStep(step1);
    await updateJob(jobId, { swappedVideoKey: swappedKey, progress: 60, stepTimings: timings });
    console.log(`  ✅ Face swap done in ${step1.durationLabel} (worker: ${result.output?.elapsed?.toFixed(1)}s)`);

    // ─── Step 2: Audio Personalization ───────────────────────────────────
    const step2 = startStep(timings, "audio_processing", "Audio Personalization");
    await updateJob(jobId, { status: "audio_processing", progress: 65, stepTimings: timings });
    console.log(`\n🎵 Step 2: Audio personalization for "${job.user.name}"`);

    const finalAudioPath = await generatePersonalizedAudio(job.user.name, workDir);
    endStep(step2);
    await updateJob(jobId, { progress: 80, stepTimings: timings });
    console.log(`  ✅ Audio done in ${step2.durationLabel}`);

    // ─── Step 3: Download swapped video, merge audio, upload ────────────
    const step3 = startStep(timings, "merging", "Video Merge & Upload");
    await updateJob(jobId, { status: "merging", progress: 85, stepTimings: timings });
    console.log(`\n🔀 Step 3: Merging face-swapped video with personalized audio`);

    // Download face-swapped video from S3 (streaming to disk, no RAM buffering)
    const swappedVideoPath = path.join(workDir, "swapped.mp4");
    const swappedUrl = await getPresignedDownloadUrl(swappedKey);
    const dlStart = Date.now();
    const videoRes = await fetch(swappedUrl);
    if (!videoRes.ok || !videoRes.body) throw new Error("Failed to download face-swapped video from S3");
    await pipeline(
      Readable.fromWeb(videoRes.body as import("stream/web").ReadableStream),
      fs.createWriteStream(swappedVideoPath)
    );
    console.log(`  ▸ S3 download: ${((Date.now() - dlStart) / 1000).toFixed(1)}s`);

    // Merge audio into video (FFmpeg -c:v copy — no re-encoding)
    const finalVideoPath = path.join(workDir, "final.mp4");
    const mergeStart = Date.now();
    await mergeAudioIntoVideo(swappedVideoPath, finalAudioPath, finalVideoPath);
    console.log(`  ▸ FFmpeg merge: ${((Date.now() - mergeStart) / 1000).toFixed(1)}s`);

    // Upload final video to S3 (streaming multipart) + generate presigned URL in parallel
    const finalKey = `outputs/final_${jobId}.mp4`;
    const ulStart = Date.now();
    const [, downloadUrl] = await Promise.all([
      streamUploadToS3(finalKey, finalVideoPath, "video/mp4"),
      getPresignedDownloadUrl(finalKey),
    ]);
    console.log(`  ▸ S3 upload: ${((Date.now() - ulStart) / 1000).toFixed(1)}s`);

    endStep(step3);

    // Finalize timings
    timings.pipelineCompletedAt = new Date().toISOString();
    timings.totalDurationMs = new Date(timings.pipelineCompletedAt).getTime() - new Date(timings.pipelineStartedAt).getTime();
    timings.totalDurationLabel = formatDuration(timings.totalDurationMs);

    await updateJob(jobId, {
      status: "done",
      progress: 100,
      finalVideoKey: finalKey,
      finalVideoUrl: downloadUrl,
      stepTimings: timings,
    });

    console.log(`\n🎉 Pipeline complete for job ${jobId}`);
    console.log(`   📁 Final video: s3://${finalKey}`);
    console.log(`   ⏱️  Total: ${timings.totalDurationLabel}`);
    timings.steps.forEach((s) => {
      console.log(`      ${s.step}: ${s.durationLabel || "in progress"}`);
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`\n❌ Pipeline error for job ${jobId}:`, message);

    // Mark failed step
    const lastStep = timings.steps[timings.steps.length - 1];
    if (lastStep && !lastStep.completedAt) {
      endStep(lastStep);
    }
    timings.pipelineCompletedAt = new Date().toISOString();
    timings.totalDurationMs = new Date(timings.pipelineCompletedAt).getTime() - new Date(timings.pipelineStartedAt).getTime();
    timings.totalDurationLabel = formatDuration(timings.totalDurationMs);

    await updateJob(jobId, { status: "error", errorMessage: message, stepTimings: timings });
    throw error;

  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

async function updateJob(jobId: string, data: Record<string, unknown>) {
  await db.job.update({ where: { id: jobId }, data });
}
