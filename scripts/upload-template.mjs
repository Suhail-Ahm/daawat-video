/**
 * Upload template.mp4 to S3
 * Run: node scripts/upload-template.mjs
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || "daawat-video";
const TEMPLATE_PATH = "../swap/assets/template.mp4";
const S3_KEY = "assets/template.mp4";

console.log(`📤 Uploading ${TEMPLATE_PATH} → s3://${BUCKET}/${S3_KEY}`);

const body = readFileSync(TEMPLATE_PATH);
console.log(`   File size: ${(body.length / 1024 / 1024).toFixed(1)} MB`);

await s3.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: S3_KEY,
    Body: body,
    ContentType: "video/mp4",
  })
);

console.log(`✅ Uploaded! URL: https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${S3_KEY}`);
