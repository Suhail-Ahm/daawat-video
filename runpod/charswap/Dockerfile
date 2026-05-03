# ═══════════════════════════════════════════════════════════════════════
# Wan 2.2 Character Swap — ComfyUI RunPod Serverless Worker
#
# Built from CUDA 12.4 base (compatible with US-TX-3 RTX 4090 drivers)
# Based on: github.com/runpod-workers/worker-comfyui
#
# Network Volume: many_silver_krill (US-TX-3)
#   /runpod-volume/comfyui/models/diffusion_models/
#   /runpod-volume/comfyui/models/text_encoders/
#   /runpod-volume/comfyui/models/vae/
# ═══════════════════════════════════════════════════════════════════════

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

LABEL org.opencontainers.image.source="https://github.com/Suhail-Ahm/daawat-video"

# ─── System setup ────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_PREFER_BINARY=1
ENV PYTHONUNBUFFERED=1
ENV CMAKE_BUILD_PARALLEL_LEVEL=8

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    wget \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && apt-get autoremove -y && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# ─── Python venv ─────────────────────────────────────────────────────
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

RUN pip install --upgrade pip setuptools wheel

# ─── Install ComfyUI ─────────────────────────────────────────────────
RUN pip install comfy-cli \
    && /usr/bin/yes | comfy --workspace /comfyui install --nvidia

WORKDIR /comfyui

# ─── Extra model paths (network volume) ──────────────────────────────
RUN printf 'runpod_volume:\n\
  base_path: /runpod-volume/comfyui/models/\n\
  diffusion_models: diffusion_models/\n\
  text_encoders: text_encoders/\n\
  vae: vae/\n\
  clip_vision: clip_vision/\n\
  checkpoints: checkpoints/\n\
  loras: loras/\n' > /comfyui/extra_model_paths.yaml

WORKDIR /

# ─── RunPod handler ──────────────────────────────────────────────────
RUN pip install runpod requests websocket-client

# Clone the worker-comfyui handler files
RUN git clone --depth 1 https://github.com/runpod-workers/worker-comfyui.git /tmp/worker \
    && cp /tmp/worker/handler.py /handler.py \
    && cp /tmp/worker/src/start.sh /start.sh \
    && cp /tmp/worker/src/network_volume.py /network_volume.py \
    && chmod +x /start.sh \
    && rm -rf /tmp/worker

# ─── Install Wan 2.2 custom nodes ───────────────────────────────────
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    cd ComfyUI-WanVideoWrapper && \
    pip install -r requirements.txt || true

# SAM2 for subject masking
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-segment-anything-2.git && \
    cd ComfyUI-segment-anything-2 && \
    pip install -r requirements.txt || true

# Video Helper Suite for video I/O
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    cd ComfyUI-VideoHelperSuite && \
    pip install -r requirements.txt || true

# Prevent pip from asking for confirmation
ENV PIP_NO_INPUT=1

CMD ["/start.sh"]
