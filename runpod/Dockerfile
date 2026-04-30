# ═══════════════════════════════════════════════════════════════════════
# FaceFusion RunPod Serverless Worker
# Matches: https://github.com/facefusion/facefusion-docker/Dockerfile.cuda
# ═══════════════════════════════════════════════════════════════════════

FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

ARG FACEFUSION_VERSION=3.6.1
ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# ─── System deps + Python 3.12 (required by onnxruntime 1.24.4) ───────
# Ubuntu 22.04 ships Python 3.10, but FaceFusion 3.6.1 needs ≥3.11.
# Install Python 3.12 from deadsnakes PPA.
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    git \
    curl \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ─── Make python3.12 the default python ────────────────────────────────
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1 && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 && \
    curl -sS https://bootstrap.pypa.io/get-pip.py | python

# ─── Clone FaceFusion (pinned version) ─────────────────────────────────
RUN git clone https://github.com/facefusion/facefusion.git \
    --branch ${FACEFUSION_VERSION} --single-branch /app/facefusion

WORKDIR /app/facefusion

# ─── Install FaceFusion deps ──────────────────────────────────────────
# Install from requirements.txt, skip onnxruntime (CPU), install GPU version
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y onnxruntime && \
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
