/**
 * RunPod Serverless API Client
 * Handles face swap jobs via FaceFusion on CUDA GPUs
 */

const RUNPOD_BASE = "https://api.runpod.ai/v2";

interface RunPodJobInput {
  source_url: string; // S3 URL to selfie
  target_url: string; // S3 URL to template video
  upload_url: string; // Presigned S3 PUT URL for output
  gender?: string;
}

interface RunPodResponse {
  id: string;
  status: string;
}

interface RunPodStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    status: string;
    elapsed: number;
    video_s3_key?: string;
    error?: string;
  };
  error?: string;
}

/**
 * Submit a face swap job to RunPod Serverless
 */
export async function submitFaceSwapJob(input: RunPodJobInput): Promise<RunPodResponse> {
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;

  if (!endpointId || !apiKey) {
    throw new Error("RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY are required");
  }

  const res = await fetch(`${RUNPOD_BASE}/${endpointId}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        source_url: input.source_url,
        target_url: input.target_url,
        upload_url: input.upload_url,
        gender: input.gender || "female",
      },
      policy: {
        executionTimeout: 600000, // 10 min max
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod submit failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Check the status of a RunPod job
 */
export async function checkFaceSwapStatus(jobId: string): Promise<RunPodStatusResponse> {
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;

  const res = await fetch(`${RUNPOD_BASE}/${endpointId}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`RunPod status check failed (${res.status})`);
  }

  return res.json();
}

/**
 * Poll until a RunPod job completes (with timeout)
 */
export async function waitForFaceSwap(
  jobId: string,
  maxWaitMs = 600000,
  pollIntervalMs = 5000
): Promise<RunPodStatusResponse> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await checkFaceSwapStatus(jobId);

    if (status.status === "COMPLETED") return status;
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`Face swap failed: ${status.error || JSON.stringify(status.output)}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Face swap timed out after ${maxWaitMs / 1000}s`);
}
