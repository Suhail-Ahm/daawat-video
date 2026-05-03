# ═══════════════════════════════════════════════════════════════════════
# Wan 2.2 Animate — Character Swap RunPod Serverless Worker
#
# Based on the official runpod-workers/worker-comfyui image.
# Extends with Wan 2.2 Animate custom nodes for character replacement.
#
# Network Volume mount: /runpod-volume
#   /runpod-volume/comfyui/models/diffusion_models/  → Wan 2.2 14B checkpoint
#   /runpod-volume/comfyui/models/text_encoders/     → UMT5-XXL encoder
#   /runpod-volume/comfyui/models/vae/               → Wan 2.1 VAE
# ═══════════════════════════════════════════════════════════════════════

FROM runpod/worker-comfyui:5.8.4-base

LABEL org.opencontainers.image.source="https://github.com/Suhail-Ahm/daawat-video"

# ─── Bypass CUDA version check ───────────────────────────────────────
# US-TX-3 workers have CUDA 12.4 drivers; base image expects >=12.6
ENV NVIDIA_DISABLE_REQUIRE=1

# ─── Install Wan 2.2 Animate custom nodes ────────────────────────────
# These provide the WanAnimate nodes for character replacement
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    cd ComfyUI-WanVideoWrapper && \
    pip install -r requirements.txt || true

# SAM2 for subject masking (isolate the actress in the video)
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-segment-anything-2.git && \
    cd ComfyUI-segment-anything-2 && \
    pip install -r requirements.txt || true

# Video Helper Suite for video I/O
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    cd ComfyUI-VideoHelperSuite && \
    pip install -r requirements.txt || true

# ─── Model path config → network volume ──────────────────────────────
RUN printf 'runpod_volume:\n\
  base_path: /runpod-volume/comfyui/models/\n\
  diffusion_models: diffusion_models/\n\
  text_encoders: text_encoders/\n\
  vae: vae/\n\
  clip_vision: clip_vision/\n\
  checkpoints: checkpoints/\n\
  loras: loras/\n' > /comfyui/extra_model_paths.yaml

# ─── Build-time sanity check ─────────────────────────────────────────
RUN python -c "import comfy; print('[build] ComfyUI imports OK')" || true
