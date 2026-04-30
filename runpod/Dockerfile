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

# ─── Pre-download models (zero cold-start) ───────────────────────────
# Use --download-scope lite to avoid downloading ALL 95 models (build timeout)
# This downloads only the essential models needed for face processing
RUN python facefusion.py force-download --download-scope lite

# ─── Verify models ───────────────────────────────────────────────────
RUN python -c "\
import os, glob; \
files = glob.glob('/app/.assets/**/*.onnx', recursive=True) + \
        glob.glob('/app/.assets/**/*.dfm', recursive=True) + \
        glob.glob('/app/.assets/**/*.hash', recursive=True); \
onnx = [f for f in files if f.endswith('.onnx')]; \
assert len(onnx) >= 2, f'Expected 2+ models, found {len(onnx)}'; \
[print(f'✅ {os.path.basename(f)}: {os.path.getsize(f)/1024/1024:.1f}MB') for f in sorted(onnx)]; \
print(f'🎯 {len(onnx)} models OK!')"

# ─── Copy handler ────────────────────────────────────────────────────
COPY runpod/handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
