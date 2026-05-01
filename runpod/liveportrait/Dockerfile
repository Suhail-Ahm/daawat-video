# ═══════════════════════════════════════════════════════════════════════
# LivePortrait RunPod Serverless Worker
# Face Animation: source selfie + driving video → animated face in frame
#
# Network Volume mount: /runpod-volume
#   /runpod-volume/pretrained_weights/liveportrait/   → LivePortrait model checkpoints
#   /runpod-volume/pretrained_weights/insightface/    → InsightFace buffalo_l models
# ═══════════════════════════════════════════════════════════════════════

FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

LABEL org.opencontainers.image.source="https://github.com/Suhail-Ahm/daawat-video"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ─── System deps (Ubuntu 22.04 ships Python 3.10) ────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-dev \
        git wget ffmpeg \
        g++ \
        libsm6 libxext6 libgl1 libglib2.0-0 \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Clone LivePortrait (pinned commit for reproducibility) ──────────
# Replace with current good commit from:
# https://github.com/KlingAIResearch/LivePortrait/commits/main
ARG LIVEPORTRAIT_COMMIT=main
RUN git clone https://github.com/KlingAIResearch/LivePortrait.git /app/LivePortrait \
    && cd /app/LivePortrait \
    && git checkout ${LIVEPORTRAIT_COMMIT}

# ─── PyTorch BEFORE LivePortrait reqs, with explicit CUDA build ──────
RUN pip install --upgrade pip wheel \
    && pip install torch==2.3.0 torchvision==0.18.0 \
       --index-url https://download.pytorch.org/whl/cu121

# ─── LivePortrait deps (strip torch lines to prevent downgrade) ──────
RUN sed -i -E '/^torch(vision)?([\<\>=!~ ]|$)/d' \
        /app/LivePortrait/requirements.txt \
    && pip install -r /app/LivePortrait/requirements.txt

# ─── Our handler deps ────────────────────────────────────────────────
COPY runpod/liveportrait/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# ─── Handler (smallest, most-changed layer — keep last) ──────────────
COPY runpod/liveportrait/handler.py /app/handler.py

ENV PYTHONPATH=/app/LivePortrait:${PYTHONPATH} \
    LIVEPORTRAIT_MODEL_DIR=/runpod-volume/pretrained_weights/liveportrait \
    INSIGHTFACE_MODEL_DIR=/runpod-volume/pretrained_weights/insightface

# ─── Build-time sanity check ─────────────────────────────────────────
RUN python -c "\
import runpod; \
import sys; sys.path.insert(0, '/app/LivePortrait'); \
from src.config.argument_config import ArgumentConfig; \
from src.live_portrait_pipeline import LivePortraitPipeline; \
print('[build] imports OK')"

CMD ["python", "-u", "/app/handler.py"]
