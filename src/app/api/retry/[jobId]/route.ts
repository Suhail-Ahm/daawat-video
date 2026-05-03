/**
 * POST /api/retry/[jobId] — Retry a failed job
 * Reuses the existing user + selfie from the original job
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processVideoJob } from "@/lib/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Find the original job
    const original = await db.job.findUnique({
      where: { id: jobId },
      include: { user: true },
    });

    if (!original) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (original.status !== "error") {
      return NextResponse.json(
        { error: "Only failed jobs can be retried" },
        { status: 400 }
      );
    }

    // Optionally allow changing swapMode via request body
    let swapMode = original.swapMode || "face";
    try {
      const body = await req.json();
      if (body?.swapMode) {
        swapMode = body.swapMode === "character" ? "character" : "face";
      }
    } catch {
      // No body or invalid JSON — use original swapMode
    }

    // Create a new job reusing the same user and selfie
    const newJob = await db.job.create({
      data: {
        userId: original.userId,
        selfieS3Key: original.selfieS3Key,
        swapMode,
        status: "pending",
        progress: 0,
      },
    });

    // Trigger pipeline in background
    processVideoJob(newJob.id).catch((err) => {
      console.error(`Background pipeline error for retried job ${newJob.id}:`, err);
    });

    console.log(
      `🔄 Retrying job ${jobId} → new job ${newJob.id} (${swapMode}, user: ${original.user.name})`
    );

    return NextResponse.json({
      jobId: newJob.id,
      status: "pending",
      statusUrl: `/api/status/${newJob.id}`,
      retriedFrom: jobId,
    });
  } catch (error) {
    console.error("Retry error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
