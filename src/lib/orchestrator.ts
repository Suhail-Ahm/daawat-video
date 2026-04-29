/**
 * Video Pipeline Orchestrator
 * Coordinates: Face Swap (RunPod) → Audio (local) → Merge → Upload
 */

import { db } from "./db";
import { uploadToS3, getPresignedUploadUrl, getPresignedDownloadUrl } from "./s3";
import { submitFaceSwapJob, waitForFaceSwap } from "./runpod";
import { generatePersonalizedAudio, mergeAudioIntoVideo } from "./audio-pipeline";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Run the full personalization pipeline for a job
 */
export async function processVideoJob(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { user: true } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const workDir = path.join(os.tmpdir(), `daawat_${jobId}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // ─── Step 1: Face Swap via RunPod (~3 min) ──────────────────────────
    await updateJob(jobId, { status: "face_swapping", progress: 10 });
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

    await updateJob(jobId, { runpodJobId: runpodJob.id, progress: 20 });
    console.log(`  ▸ RunPod job submitted: ${runpodJob.id}`);

    // Poll until complete
    const result = await waitForFaceSwap(runpodJob.id);
    await updateJob(jobId, { swappedVideoKey: swappedKey, progress: 60 });
    console.log(`  ✅ Face swap done in ${result.output?.elapsed?.toFixed(1)}s`);

    // ─── Step 2: Audio Personalization (~10 sec) ────────────────────────
    await updateJob(jobId, { status: "audio_processing", progress: 65 });
    console.log(`\n🎵 Step 2: Audio personalization for "${job.user.name}"`);

    const finalAudioPath = await generatePersonalizedAudio(job.user.name, workDir);
    await updateJob(jobId, { progress: 80 });

    // ─── Step 3: Download swapped video, merge audio, upload ────────────
    await updateJob(jobId, { status: "merging", progress: 85 });
    console.log(`\n🔀 Step 3: Merging face-swapped video with personalized audio`);

    // Download face-swapped video from S3
    const swappedVideoPath = path.join(workDir, "swapped.mp4");
    const swappedUrl = await getPresignedDownloadUrl(swappedKey);
    const videoRes = await fetch(swappedUrl);
    if (!videoRes.ok) throw new Error("Failed to download face-swapped video from S3");
    fs.writeFileSync(swappedVideoPath, Buffer.from(await videoRes.arrayBuffer()));

    // Merge audio into video
    const finalVideoPath = path.join(workDir, "final.mp4");
    await mergeAudioIntoVideo(swappedVideoPath, finalAudioPath, finalVideoPath);

    // Upload final video to S3
    const finalKey = `outputs/final_${jobId}.mp4`;
    const finalBuffer = fs.readFileSync(finalVideoPath);
    await uploadToS3(finalKey, finalBuffer, "video/mp4");

    // Generate public download URL (24h expiry)
    const downloadUrl = await getPresignedDownloadUrl(finalKey);

    await updateJob(jobId, {
      status: "done",
      progress: 100,
      finalVideoKey: finalKey,
      finalVideoUrl: downloadUrl,
    });

    console.log(`\n🎉 Pipeline complete for job ${jobId}`);
    console.log(`   📁 Final video: s3://${finalKey}`);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`\n❌ Pipeline error for job ${jobId}:`, message);
    await updateJob(jobId, { status: "error", errorMessage: message });
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
