/**
 * Test RunPod Serverless Endpoint
 * Run: node scripts/test-runpod.mjs
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log("🧪 RunPod Serverless Test");
console.log(`   Endpoint: ${ENDPOINT_ID}`);
console.log(`   S3 Bucket: ${BUCKET}\n`);

// Step 1: Upload test selfie to S3
console.log("📤 Step 1: Uploading test selfie to S3...");
const selfieBuffer = readFileSync("../video-swap/selfie.png");
const selfieKey = "test/selfie.png";

await s3.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: selfieKey,
    Body: selfieBuffer,
    ContentType: "image/png",
  })
);
console.log(`   ✅ Uploaded selfie (${(selfieBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

const sourceUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${selfieKey}`;
const targetUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/assets/template.mp4`;

// Step 2: Submit job to RunPod
console.log("\n🚀 Step 2: Submitting face swap job to RunPod...");
const submitRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RUNPOD_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: {
      source_url: sourceUrl,
      target_url: targetUrl,
      gender: "female",
    },
  }),
});

const submitData = await submitRes.json();
if (!submitRes.ok) {
  console.error("❌ Submit failed:", submitData);
  process.exit(1);
}

const jobId = submitData.id;
console.log(`   ✅ Job submitted: ${jobId}`);
console.log(`   Status: ${submitData.status}`);

// Step 3: Poll for completion
console.log("\n⏳ Step 3: Polling for completion (may take 3-5 min on cold start)...");
const startTime = Date.now();

while (true) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  
  const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
  });
  const statusData = await statusRes.json();

  console.log(`   [${elapsed}s] Status: ${statusData.status}`);

  if (statusData.status === "COMPLETED") {
    console.log("\n🎉 SUCCESS! Face swap completed!");
    console.log("   Output:", JSON.stringify(statusData.output, null, 2));
    console.log(`   Total time: ${elapsed}s`);
    break;
  }

  if (statusData.status === "FAILED") {
    console.error("\n❌ FAILED!");
    console.error("   Error:", statusData.error || JSON.stringify(statusData.output));
    break;
  }

  // Wait 5 seconds before next poll
  await new Promise((r) => setTimeout(r, 5000));
}
