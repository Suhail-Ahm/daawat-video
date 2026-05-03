# Wan 2.2 Animate — Character Swap Worker

## Network Volume: `many_silver_krill` (US-TX-3)

### Model Files (already provisioned ✅)

```
/runpod-volume/comfyui/models/
├── diffusion_models/
│   └── wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors  (14 GB)
├── text_encoders/
│   └── umt5_xxl_fp8_e4m3fn_scaled.safetensors                   (6.3 GB)
└── vae/
    └── wan_2.1_vae.safetensors                                   (243 MB)
```

Source: https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged

## Deployment

1. Build Docker image:
   ```bash
   docker build -f runpod/charswap/Dockerfile -t ghcr.io/suhail-ahm/daawat-charswap:latest .
   docker push ghcr.io/suhail-ahm/daawat-charswap:latest
   ```

2. Create RunPod Serverless Endpoint:
   - **GPU:** A40 (48GB) — High availability
   - **Network Volume:** `many_silver_krill` (US-TX-3)
   - **Docker Image:** `ghcr.io/suhail-ahm/daawat-charswap:latest`
   - **Environment Variables:**
     - `COMFY_OUTPUT_PATH=/comfyui/output`

3. Update `.env`:
   ```
   RUNPOD_CHARSWAP_ENDPOINT_ID=<new-endpoint-id>
   ```

## API Input Format

The worker uses the standard `runpod-workers/worker-comfyui` API format.
Submit a workflow JSON with input images (selfie + template video) via the RunPod `/run` endpoint.

## How Character Swap Works

1. **Source image** (user selfie) → uploaded as input image
2. **Template video** → pre-uploaded to S3, downloaded by worker
3. **Wan 2.2 Fun Inpaint** → replaces the actress character with user's face identity
4. **Output** → character-swapped video uploaded to S3
