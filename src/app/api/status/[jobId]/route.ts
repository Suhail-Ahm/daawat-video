/**
 * GET /api/status/[jobId] — Check job processing status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const STATUS_LABELS: Record<string, string> = {
  pending: "Starting up...",
  face_swapping: "Swapping your face into the video",
  audio_processing: "Adding your name to the audio",
  merging: "Finalizing your personalized video",
  done: "Your video is ready!",
  error: "Something went wrong",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { user: { select: { name: true } } },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Calculate elapsed time since creation
  const elapsedMs = Date.now() - new Date(job.createdAt).getTime();

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    statusLabel: STATUS_LABELS[job.status] || job.status,
    name: job.user.name,
    videoUrl: job.status === "done" ? job.finalVideoUrl : null,
    error: job.status === "error" ? job.errorMessage : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    elapsedMs,
    stepTimings: job.stepTimings || null,
  });
}
