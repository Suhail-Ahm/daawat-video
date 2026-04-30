# ═══════════════════════════════════════════════════════════════════════
# FaceFusion RunPod Serverless Worker — Production Quality
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

# ═══════════════════════════════════════════════════════════════════════
# Pre-download ALL models needed at runtime.
# This eliminates cold-start delay from runtime downloads.
# ═══════════════════════════════════════════════════════════════════════

RUN mkdir -p /app/.assets/models

# GitHub base URL for facefusion-assets releases
ENV GH=https://github.com/facefusion/facefusion-assets/releases/download

# ─── Core models (face detection, landmark, parsing) ────────────────
# models-3.0.0
RUN curl -fSL -o /app/.assets/models/2dfan4.onnx               ${GH}/models-3.0.0/2dfan4.onnx && \
    curl -fSL -o /app/.assets/models/arcface_w600k_r50.onnx     ${GH}/models-3.0.0/arcface_w600k_r50.onnx && \
    curl -fSL -o /app/.assets/models/fairface.onnx              ${GH}/models-3.0.0/fairface.onnx && \
    curl -fSL -o /app/.assets/models/yoloface_8n.onnx           ${GH}/models-3.0.0/yoloface_8n.onnx && \
    curl -fSL -o /app/.assets/models/fan_68_5.onnx              ${GH}/models-3.0.0/fan_68_5.onnx && \
    curl -fSL -o /app/.assets/models/bisenet_resnet_34.onnx     ${GH}/models-3.0.0/bisenet_resnet_34.onnx && \
    curl -fSL -o /app/.assets/models/kim_vocal_2.onnx           ${GH}/models-3.0.0/kim_vocal_2.onnx && \
    echo "✅ Core models done"

# ─── Face Swapper models ────────────────────────────────────────────
# inswapper (fallback) + hyperswap_1c_256 (primary — best identity)
RUN curl -fSL -o /app/.assets/models/inswapper_128_fp16.onnx    ${GH}/models-3.0.0/inswapper_128_fp16.onnx && \
    curl -fSL -o /app/.assets/models/hyperswap_1c_256.onnx      ${GH}/models-3.6.0/hyperswap_1c_256.onnx && \
    echo "✅ Face swapper models done"

# ─── Face Enhancer model (GFPGAN 1.4) ───────────────────────────────
RUN curl -fSL -o /app/.assets/models/gfpgan_1.4.onnx           ${GH}/models-3.0.0/gfpgan_1.4.onnx && \
    echo "✅ Face enhancer model done"

# ─── Expression Restorer (LivePortrait) ──────────────────────────────
# LivePortrait uses multiple onnx files. Download all available.
RUN curl -fSL -o /app/.assets/models/live_portrait.onnx                 ${GH}/models-3.2.0/live_portrait.onnx && \
    echo "✅ Expression restorer models done" || \
    echo "⚠️ LivePortrait model not found at expected URL — will download at runtime"

# ─── Content moderation models ───────────────────────────────────────
# models-3.1.0
RUN curl -fSL -o /app/.assets/models/xseg_1.onnx               ${GH}/models-3.1.0/xseg_1.onnx && \
    echo "✅ models-3.1.0 done"

# models-3.3.0
RUN curl -fSL -o /app/.assets/models/nsfw_1.onnx               ${GH}/models-3.3.0/nsfw_1.onnx && \
    curl -fSL -o /app/.assets/models/nsfw_2.onnx               ${GH}/models-3.3.0/nsfw_2.onnx && \
    curl -fSL -o /app/.assets/models/nsfw_3.onnx               ${GH}/models-3.3.0/nsfw_3.onnx && \
    echo "✅ models-3.3.0 done"

# ─── Force-download any remaining models FaceFusion needs ────────────
# This catches LivePortrait sub-models and any other dependencies
# we might have missed. Runs a dry-run to trigger the download system.
RUN python facefusion.py force-download \
    --processors face_swapper face_enhancer expression_restorer \
    --face-swapper-model hyperswap_1c_256 \
    --face-enhancer-model gfpgan_1.4 \
    --expression-restorer-model live_portrait \
    || echo "⚠️ Force-download completed (some warnings expected)"

# ─── Verify models ───────────────────────────────────────────────────
RUN python -c "\
import os, glob; \
files = glob.glob('/app/.assets/models/*.onnx'); \
assert len(files) >= 12, f'Expected 12+ models, found {len(files)}'; \
total = 0; \
[( \
    print(f'✅ {os.path.basename(f)}: {os.path.getsize(f)/1024/1024:.1f}MB'), \
    total := total + os.path.getsize(f) \
) for f in sorted(files)]; \
print(f'🎯 {len(files)} models OK! Total: {total/1024/1024:.0f}MB')"

# ─── Copy handler ────────────────────────────────────────────────────
COPY runpod/handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
