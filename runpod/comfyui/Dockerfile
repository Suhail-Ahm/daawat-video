# ─────────────────────────────────────────────────────────
# ComfyUI Character Swap Worker for RunPod Serverless
# Uses: Wan 2.2 Animate-14B + SAM 2 via ComfyUI
#
# Models are loaded from RunPod Network Volume (not baked)
# because Wan 2.2 14B is ~14GB — too large for Docker image.
#
# Network Volume mount: /runpod-volume
#   /runpod-volume/models/diffusion_models/  → Wan 2.2 FP8
#   /runpod-volume/models/clip/              → CLIP-ViT-H
#   /runpod-volume/models/vae/               → Wan2.2-VAE
#   /runpod-volume/models/sam2/              → SAM 2 weights
# ─────────────────────────────────────────────────────────

FROM runpod/worker-comfyui:3.2.0-base

# ── Install custom nodes ──────────────────────────────────

# Kijai's WanVideoWrapper — best ComfyUI integration for Wan 2.2
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    cd ComfyUI-WanVideoWrapper && \
    pip install --no-cache-dir -r requirements.txt || true

# SAM 2 for precise character segmentation
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/neverbiasu/ComfyUI-SAM2.git && \
    cd ComfyUI-SAM2 && \
    pip install --no-cache-dir -r requirements.txt || true

# Video Helper Suite — for loading/saving video files
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    cd ComfyUI-VideoHelperSuite && \
    pip install --no-cache-dir -r requirements.txt || true

# ── Symlink Network Volume models into ComfyUI paths ──────
# These symlinks connect /runpod-volume paths to where ComfyUI expects models
RUN mkdir -p /comfyui/models/diffusion_models && \
    mkdir -p /comfyui/models/clip && \
    mkdir -p /comfyui/models/vae && \
    mkdir -p /comfyui/models/sam2

# ── Copy our custom handler wrapper ──────────────────────
COPY runpod/comfyui/handler_wrapper.py /handler_wrapper.py
COPY runpod/comfyui/workflow_api.json /workflow_api.json

# ── Environment: S3 upload config (set via RunPod env vars) ──
ENV COMFY_OUTPUT_PATH=/comfyui/output
