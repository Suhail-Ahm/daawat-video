/**
 * POST /api/submit — Accept user form submission
 * Saves user + job to DB, uploads selfie to S3, triggers pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { processVideoJob } from "@/lib/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const selfie = formData.get("selfie") as File;

    // Validate
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (!selfie || selfie.size === 0) {
      return NextResponse.json({ error: "Selfie image is required" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(selfie.type)) {
      return NextResponse.json(
        { error: "Selfie must be PNG, JPG, or WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (selfie.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Selfie must be under 10MB" },
        { status: 400 }
      );
    }

    // Upload selfie to S3
    const ext = selfie.name.split(".").pop() || "png";
    const selfieKey = `selfies/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const selfieBuffer = Buffer.from(await selfie.arrayBuffer());
    const selfieUrl = await uploadToS3(selfieKey, selfieBuffer, selfie.type);

    // Create user + job in DB
    const user = await db.user.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        selfieUrl,
      },
    });

    const job = await db.job.create({
      data: {
        userId: user.id,
        selfieS3Key: selfieKey,
        status: "pending",
        progress: 0,
      },
    });

    // Trigger pipeline in background (don't await)
    processVideoJob(job.id).catch((err) => {
      console.error(`Background pipeline error for job ${job.id}:`, err);
    });

    return NextResponse.json({
      jobId: job.id,
      status: "pending",
      statusUrl: `/api/status/${job.id}`,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
