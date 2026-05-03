/**
 * GET /api/jobs — Fetch all jobs with user details and timing data
 * Returns a paginated list of jobs ordered by creation date (newest first)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: { name: true, phone: true, selfieUrl: true },
        },
      },
    }),
    db.job.count(),
  ]);

  // Compute stats
  const completed = jobs.filter((j) => j.status === "done");
  const avgDurationMs =
    completed.length > 0
      ? completed.reduce((sum, j) => {
          const timings = j.stepTimings as { totalDurationMs?: number } | null;
          return sum + (timings?.totalDurationMs || 0);
        }, 0) / completed.length
      : 0;

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      userName: j.user.name,
      userPhone: j.user.phone,
      swapMode: j.swapMode || "face",
      status: j.status,
      progress: j.progress,
      runpodJobId: j.runpodJobId,
      errorMessage: j.errorMessage,
      stepTimings: j.stepTimings,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      finalVideoUrl: j.finalVideoUrl,
    })),
    total,
    stats: {
      total,
      completed: completed.length,
      failed: jobs.filter((j) => j.status === "error").length,
      inProgress: jobs.filter((j) =>
        ["pending", "face_swapping", "audio_processing", "merging"].includes(j.status)
      ).length,
      avgDurationMs: Math.round(avgDurationMs),
    },
  });
}
