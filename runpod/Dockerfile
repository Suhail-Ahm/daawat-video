# ═══════════════════════════════════════════════════════════════════════
# FaceFusion RunPod Serverless Worker
# Based on: https://github.com/facefusion/facefusion-docker/Dockerfile.cuda
# ═══════════════════════════════════════════════════════════════════════

FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

ARG FACEFUSION_VERSION=3.6.1
ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# ─── System dependencies ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python-is-python3 \
    python3-pip \
    python3-dev \
    git \
    curl \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ─── Clone FaceFusion (pinned version for reproducibility) ─────────────
RUN git clone https://github.com/facefusion/facefusion.git \
    --branch ${FACEFUSION_VERSION} --single-branch /app/facefusion

WORKDIR /app/facefusion

# ─── Install FaceFusion deps from requirements.txt ─────────────────────
# install.py silently fails in this environment (completes in 16s without
# installing anything). So we install deps directly from requirements.txt
# then swap onnxruntime → onnxruntime-gpu for CUDA support.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir onnxruntime-gpu && \
    pip install --no-cache-dir runpod requests

# ─── Verify critical imports ──────────────────────────────────────────
RUN python -c "\
import sys; print('Python:', sys.executable, sys.version); \
import runpod; print('✅ runpod', runpod.__version__); \
import requests; print('✅ requests OK'); \
import cv2; print('✅ opencv', cv2.__version__); \
import numpy; print('✅ numpy', numpy.__version__); \
import onnxruntime; print('✅ onnxruntime', onnxruntime.__version__); \
print('   Providers:', onnxruntime.get_available_providers()); \
print('\n🎯 All imports verified!')"

# ─── Pre-download models at build time (zero cold-start) ──────────────
RUN python facefusion.py force-download \
    --processors face_swapper face_enhancer \
    --face-swapper-model inswapper_128 \
    --face-enhancer-model gfpgan_1.4

# ─── Verify models were downloaded ────────────────────────────────────
RUN python -c "\
import os, glob; \
onnx_files = glob.glob('/app/facefusion/.assets/**/*.onnx', recursive=True); \
assert len(onnx_files) >= 2, f'Expected 2+ models, found {len(onnx_files)}'; \
for f in sorted(onnx_files): \
    size = os.path.getsize(f) / 1024 / 1024; \
    print(f'✅ {os.path.basename(f)}: {size:.1f} MB'); \
print(f'\n🎯 {len(onnx_files)} models verified!')"

# ─── Copy handler ─────────────────────────────────────────────────────
COPY handler.py /app/handler.py

# ─── Start with unbuffered output (shows in RunPod logs) ──────────────
CMD ["python", "-u", "/app/handler.py"]
