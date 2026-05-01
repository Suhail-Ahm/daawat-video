/**
 * RunPod Serverless API Client
 * Handles both face swap (FaceFusion) and character swap (ComfyUI + Wan 2.2) jobs
 */

const RUNPOD_BASE = "https://api.runpod.ai/v2";

type SwapMode = "face" | "character";

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
 * Get the correct RunPod endpoint ID based on swap mode
 */
function getEndpointId(swapMode: SwapMode): string {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error("RUNPOD_API_KEY is required");

  if (swapMode === "character") {
    const endpointId = process.env.RUNPOD_CHARSWAP_ENDPOINT_ID;
    if (!endpointId) {
      throw new Error("RUNPOD_CHARSWAP_ENDPOINT_ID is required for character swap");
    }
    return endpointId;
  }

  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!endpointId) {
    throw new Error("RUNPOD_ENDPOINT_ID is required for face swap");
  }
  return endpointId;
}

/**
 * Submit a face swap job to RunPod Serverless (FaceFusion)
 */
export async function submitFaceSwapJob(input: RunPodJobInput): Promise<RunPodResponse> {
  return submitSwapJob(input, "face");
}

/**
 * Submit a character swap job to RunPod Serverless (ComfyUI + Wan 2.2)
 */
export async function submitCharacterSwapJob(input: RunPodJobInput): Promise<RunPodResponse> {
  return submitSwapJob(input, "character");
}

/**
 * Internal: Submit a swap job to the correct RunPod endpoint
 */
async function submitSwapJob(input: RunPodJobInput, swapMode: SwapMode): Promise<RunPodResponse> {
  const endpointId = getEndpointId(swapMode);
  const apiKey = process.env.RUNPOD_API_KEY!;

  // Character swap gets a longer timeout (10 min vs 5 min)
  const timeoutMs = swapMode === "character" ? 600000 : 300000;

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
        executionTimeout: timeoutMs,
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
 * Check the status of a RunPod job (works for both swap modes)
 */
export async function checkSwapStatus(jobId: string, swapMode: SwapMode = "face"): Promise<RunPodStatusResponse> {
  const endpointId = getEndpointId(swapMode);
  const apiKey = process.env.RUNPOD_API_KEY!;

  const res = await fetch(`${RUNPOD_BASE}/${endpointId}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`RunPod status check failed (${res.status})`);
  }

  return res.json();
}

/**
 * @deprecated Use checkSwapStatus instead
 */
export async function checkFaceSwapStatus(jobId: string): Promise<RunPodStatusResponse> {
  return checkSwapStatus(jobId, "face");
}

/**
 * Poll until a RunPod job completes (with timeout)
 */
export async function waitForSwap(
  jobId: string,
  swapMode: SwapMode = "face",
  maxWaitMs = 600000,
  pollIntervalMs = 5000
): Promise<RunPodStatusResponse> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await checkSwapStatus(jobId, swapMode);

    if (status.status === "COMPLETED") return status;
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`Swap failed: ${status.error || JSON.stringify(status.output)}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Swap timed out after ${maxWaitMs / 1000}s`);
}

/**
 * @deprecated Use waitForSwap instead
 */
export async function waitForFaceSwap(
  jobId: string,
  maxWaitMs = 600000,
  pollIntervalMs = 5000
): Promise<RunPodStatusResponse> {
  return waitForSwap(jobId, "face", maxWaitMs, pollIntervalMs);
}
