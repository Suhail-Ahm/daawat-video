# ═══════════════════════════════════════════════════════════════════════
# FaceFusion RunPod Serverless Worker
# ═══════════════════════════════════════════════════════════════════════

# RunPod's official PyTorch image with Python 3.11 + CUDA 12.4
# Has pip, python, CUDA all pre-configured and tested for RunPod
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ARG FACEFUSION_VERSION=3.6.1

# ─── System deps ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ─── Clone FaceFusion (pinned version) ────────────────────────────────
WORKDIR /app
RUN git clone https://github.com/facefusion/facefusion.git \
    --branch ${FACEFUSION_VERSION} --single-branch .

# ─── Install dependencies ────────────────────────────────────────────
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y onnxruntime && \
    pip install --no-cache-dir onnxruntime-gpu && \
    pip install --no-cache-dir runpod requests

# ─── Verify imports ──────────────────────────────────────────────────
RUN python -c "\
import sys; print('Python:', sys.version); \
import runpod; print('✅ runpod', runpod.__version__); \
import cv2; print('✅ opencv', cv2.__version__); \
import numpy; print('✅ numpy', numpy.__version__); \
import onnxruntime; print('✅ onnxruntime', onnxruntime.__version__); \
print('   Providers:', onnxruntime.get_available_providers()); \
print('🎯 All imports OK!')"

# ─── Pre-download ONLY essential face-swap models ─────────────────────
# Instead of force-download (downloads 30+ models, causes build timeout),
# we manually download only the 6 models needed for face swapping.
# Source: https://github.com/facefusion/facefusion-assets

# Create the model directories
RUN mkdir -p /app/.assets/models

# Base URL for facefusion-assets on GitHub
ENV ASSETS_URL=https://github.com/facefusion/facefusion-assets/releases/download/models-3.6.0

# 1. Face detector: retinaface (16MB)
RUN wget -q --show-progress -O /app/.assets/models/retinaface_10g.onnx \
    ${ASSETS_URL}/retinaface_10g.onnx

# 2. Face landmarker: 2dfan4 (93MB) + peppa_wutz (13MB)
RUN wget -q --show-progress -O /app/.assets/models/2dfan4.onnx \
    ${ASSETS_URL}/2dfan4.onnx && \
    wget -q --show-progress -O /app/.assets/models/peppa_wutz.onnx \
    ${ASSETS_URL}/peppa_wutz.onnx

# 3. Face recognizer: arcface (166MB)
RUN wget -q --show-progress -O /app/.assets/models/arcface_w600k_r50.onnx \
    ${ASSETS_URL}/arcface_w600k_r50.onnx

# 4. Face masker: xseg (67MB)
RUN wget -q --show-progress -O /app/.assets/models/xseg_1.onnx \
    ${ASSETS_URL}/xseg_1.onnx

# 5. Face swapper: inswapper_128_fp16 (the core swap model, ~200MB)
RUN wget -q --show-progress -O /app/.assets/models/inswapper_128_fp16.onnx \
    ${ASSETS_URL}/inswapper_128_fp16.onnx

# 6. NSFW filter (required by FaceFusion to start)
RUN wget -q --show-progress -O /app/.assets/models/nsfw_1.onnx \
    ${ASSETS_URL}/nsfw_1.onnx

# ─── Verify models ───────────────────────────────────────────────────
RUN python -c "\
import os, glob; \
files = glob.glob('/app/.assets/models/*.onnx'); \
assert len(files) >= 5, f'Expected 5+ models, found {len(files)}'; \
total = 0; \
[( \
    print(f'✅ {os.path.basename(f)}: {os.path.getsize(f)/1024/1024:.1f}MB'), \
    total := total + os.path.getsize(f) \
) for f in sorted(files)]; \
print(f'🎯 {len(files)} models OK! Total: {total/1024/1024:.0f}MB')"

# ─── Copy handler ────────────────────────────────────────────────────
COPY runpod/handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
