# ═══════════════════════════════════════════════════════════════════════
# FaceFusion RunPod Serverless Worker
# ═══════════════════════════════════════════════════════════════════════

# RunPod's official PyTorch image with Python 3.11 + CUDA 12.4
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

ARG FACEFUSION_VERSION=3.6.1

# ─── System deps ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    ffmpeg libgl1 libglib2.0-0 libcudnn9-cuda-12 \
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
# we manually download only the models needed for face swapping.
# Models are spread across different release tags on GitHub.

RUN mkdir -p /app/.assets/models

# GitHub base URL
ENV GH=https://github.com/facefusion/facefusion-assets/releases/download

# Download all essential models in a single layer (saves build time)
RUN curl -fSL -o /app/.assets/models/retinaface_10g.onnx      ${GH}/models-3.0.0/retinaface_10g.onnx && \
    curl -fSL -o /app/.assets/models/2dfan4.onnx               ${GH}/models-3.0.0/2dfan4.onnx && \
    curl -fSL -o /app/.assets/models/peppa_wutz.onnx            ${GH}/models-3.0.0/peppa_wutz.onnx && \
    curl -fSL -o /app/.assets/models/arcface_w600k_r50.onnx     ${GH}/models-3.0.0/arcface_w600k_r50.onnx && \
    curl -fSL -o /app/.assets/models/inswapper_128_fp16.onnx    ${GH}/models-3.0.0/inswapper_128_fp16.onnx && \
    curl -fSL -o /app/.assets/models/xseg_1.onnx                ${GH}/models-3.1.0/xseg_1.onnx && \
    curl -fSL -o /app/.assets/models/nsfw_1.onnx                ${GH}/models-3.3.0/nsfw_1.onnx && \
    echo "✅ All models downloaded"

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
