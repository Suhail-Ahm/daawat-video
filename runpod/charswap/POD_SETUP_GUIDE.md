# Wan 2.2 Character Swap — RunPod Pod Setup Guide

> Complete step-by-step guide to set up an interactive ComfyUI pod on RunPod  
> for testing the Wan 2.2 FunInpaint Character Swap workflow.

---

## 1. Pod Configuration (RunPod Dashboard)

Create a new **GPU Pod** with these settings:

| Setting                    | Value                                                        |
| -------------------------- | ------------------------------------------------------------ |
| **Container Image**        | `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04`  |
| **GPU**                    | RTX 4090 (24 GB VRAM) — required for 14B FP8 model          |
| **Container Disk**         | 30 GB (ComfyUI + custom nodes + temp files)                  |
| **Network Volume**         | `many_silver_krill` (or your persistent volume)              |
| **Volume Mount Path**      | `/runpod-volume`                                             |
| **Expose HTTP Ports**      | `8888, 8188`                                                 |
| **Expose TCP Ports**       | `22`                                                         |

### ⚠️ Critical: Volume Mount Path

**Always mount the network volume at `/runpod-volume`**, NOT `/workspace`.

If you mount at `/workspace`, installing ComfyUI there (`comfy --workspace /workspace/comfyui install`)
will **overwrite your model files** on the network volume with empty placeholder directories.

By keeping models on `/runpod-volume` and ComfyUI on `/workspace`, they stay independent.

---

## 2. SSH Into the Pod

Once the pod shows a green status, connect via **SSH over exposed TCP**:

```bash
ssh root@<IP> -p <PORT> -i ~/.ssh/id_ed25519
```

The exact command is available in: **Pod Dashboard → Connect → SSH over exposed TCP**

---

## 3. Download Models to Network Volume

These models persist across pod restarts since they're on the network volume.
You only need to do this **once** — skip if already downloaded.

### 3a. Diffusion Model (~14 GB)

Wan 2.2 FunInpaint 14B in FP8 quantization — the core video generation model.

```bash
cd /runpod-volume/comfyui/models/diffusion_models/
wget -c "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors"
```

### 3b. Text Encoder (~6.3 GB)

UMT5-XXL in FP8 — converts text prompts into embeddings for the diffusion model.

```bash
cd /runpod-volume/comfyui/models/text_encoders/
wget -c "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"
```

### 3c. VAE (~243 MB)

Wan 2.1 VAE — encodes/decodes between pixel space and latent space.

```bash
cd /runpod-volume/comfyui/models/vae/
wget -c "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors"
```

### 3d. Verify Downloads

```bash
ls -lh /runpod-volume/comfyui/models/diffusion_models/*.safetensors
# Expected: ~14G  wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors

ls -lh /runpod-volume/comfyui/models/text_encoders/*.safetensors
# Expected: ~6.3G umt5_xxl_fp8_e4m3fn_scaled.safetensors

ls -lh /runpod-volume/comfyui/models/vae/*.safetensors
# Expected: ~243M wan_2.1_vae.safetensors
```

> **Tip**: All three downloads can run in parallel. Use `&` to background them:
> ```bash
> wget -c "<url1>" &
> wget -c "<url2>" &
> wget -c "<url3>" &
> wait  # waits for all to finish
> ```

---

## 4. Install ComfyUI (Container Disk)

ComfyUI installs to `/workspace/comfyui` on the ephemeral container disk.
This must be done each time a new pod is created (not persisted).

```bash
# Install comfy-cli
pip install comfy-cli

# Install ComfyUI (auto-approve prompts)
yes | comfy --workspace /workspace/comfyui install --nvidia
```

This installs:
- ComfyUI core
- ComfyUI Manager
- PyTorch with CUDA support
- All base dependencies

---

## 5. Install Custom Nodes

Three custom nodes are required for the Character Swap workflow:

### 5a. WanVideoWrapper

Provides the Wan 2.2 sampling, model loading, and video generation nodes.

```bash
cd /workspace/comfyui/custom_nodes
git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git
cd ComfyUI-WanVideoWrapper
pip install -r requirements.txt
```

### 5b. VideoHelperSuite (VHS)

Handles video encoding, frame extraction, and output formatting.

```bash
cd /workspace/comfyui/custom_nodes
git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git
cd ComfyUI-VideoHelperSuite
pip install -r requirements.txt
```

### 5c. Segment Anything 2 (SAM2)

Used for automatic mask generation / subject segmentation in inpainting workflows.

```bash
cd /workspace/comfyui/custom_nodes
git clone https://github.com/kijai/ComfyUI-segment-anything-2.git
```

---

## 6. Symlink Models into ComfyUI

Since models live on the network volume (`/runpod-volume`) but ComfyUI expects them
under its own directory (`/workspace/comfyui/models`), we create symlinks.

**Important**: Symlink individual files, NOT glob patterns (`*`). Globs don't expand if
the target directory doesn't exist or is empty, creating a literal file named `*`.

```bash
# Diffusion model
ln -sf /runpod-volume/comfyui/models/diffusion_models/wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors \
       /workspace/comfyui/models/diffusion_models/

# Text encoder
ln -sf /runpod-volume/comfyui/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors \
       /workspace/comfyui/models/text_encoders/

# VAE
ln -sf /runpod-volume/comfyui/models/vae/wan_2.1_vae.safetensors \
       /workspace/comfyui/models/vae/
```

### Verify Symlinks

```bash
ls -lh /workspace/comfyui/models/diffusion_models/
ls -lh /workspace/comfyui/models/text_encoders/
ls -lh /workspace/comfyui/models/vae/
```

Each `.safetensors` file should show as a symlink (`->`) pointing to the `/runpod-volume/` path.

---

## 7. Start ComfyUI

```bash
cd /workspace/comfyui
python main.py --listen 0.0.0.0 --port 8188
```

Or to run in the background:

```bash
cd /workspace/comfyui
nohup python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 &
```

### Check Logs

```bash
tail -f /tmp/comfyui.log
```

You should see:
```
To see the GUI go to: http://0.0.0.0:8188
```

---

## 8. Access the ComfyUI UI

In the RunPod dashboard:

1. Go to your Pod → **Connect** tab
2. Click **"HTTP Service"** next to **Port 8188**
3. This opens the ComfyUI interface at:
   ```
   https://<pod-id>-8188.proxy.runpod.net/
   ```

---

## 9. Quick Restart Script

For convenience, here's a single script that does steps 4–7 after a pod reset:

```bash
#!/bin/bash
set -e

echo "=== Installing ComfyUI ==="
pip install comfy-cli
yes | comfy --workspace /workspace/comfyui install --nvidia

echo "=== Installing Custom Nodes ==="
cd /workspace/comfyui/custom_nodes
git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git
cd ComfyUI-WanVideoWrapper && pip install -r requirements.txt && cd ..
git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git
cd ComfyUI-VideoHelperSuite && pip install -r requirements.txt && cd ..
git clone https://github.com/kijai/ComfyUI-segment-anything-2.git

echo "=== Symlinking Models ==="
ln -sf /runpod-volume/comfyui/models/diffusion_models/wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors \
       /workspace/comfyui/models/diffusion_models/
ln -sf /runpod-volume/comfyui/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors \
       /workspace/comfyui/models/text_encoders/
ln -sf /runpod-volume/comfyui/models/vae/wan_2.1_vae.safetensors \
       /workspace/comfyui/models/vae/

echo "=== Starting ComfyUI ==="
cd /workspace/comfyui
python main.py --listen 0.0.0.0 --port 8188
```

---

## Architecture Overview

```
Pod Container (ephemeral, 30 GB)
├── /workspace/comfyui/              ← ComfyUI installation
│   ├── main.py                      ← Entry point
│   ├── models/
│   │   ├── diffusion_models/
│   │   │   └── wan2.2_...fp8.safetensors → symlink
│   │   ├── text_encoders/
│   │   │   └── umt5_xxl_...fp8.safetensors → symlink
│   │   └── vae/
│   │       └── wan_2.1_vae.safetensors → symlink
│   └── custom_nodes/
│       ├── ComfyUI-WanVideoWrapper/
│       ├── ComfyUI-VideoHelperSuite/
│       └── ComfyUI-segment-anything-2/
│
Network Volume (persistent, many_silver_krill)
└── /runpod-volume/comfyui/models/   ← Actual model weights
    ├── diffusion_models/
    │   └── wan2.2_fun_inpaint_high_noise_14B_fp8_scaled.safetensors (14 GB)
    ├── text_encoders/
    │   └── umt5_xxl_fp8_e4m3fn_scaled.safetensors (6.3 GB)
    └── vae/
        └── wan_2.1_vae.safetensors (243 MB)
```

---

## Troubleshooting

### Symlinks show as literal `*` file
**Cause**: Using `ln -sf /path/*` when the source directory is empty or doesn't exist.  
**Fix**: Always symlink individual files by their full name, not with glob patterns.

### CUDA version mismatch
**Cause**: Base image requires CUDA 12.6+ but host driver only supports 12.4.  
**Fix**: Use `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04` as the container image.

### Models not found after pod reset
**Cause**: Pod reset wipes `/workspace` (container disk). Models are safe on `/runpod-volume`.  
**Fix**: Re-run the symlink step (step 6) after reinstalling ComfyUI.

### ComfyUI shows "No module named 'sageattention'"
**Impact**: None — this is an optional optimization. ComfyUI works fine without it.

### Port 8188 shows "Initializing" for too long
**Fix**: Check if ComfyUI is actually running: `cat /tmp/comfyui.log | tail -20`
