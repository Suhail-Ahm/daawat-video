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
# Pre-download ALL models needed at runtime (from source code analysis).
#
# Model URLs are derived from FaceFusion 3.6.1 source code:
#   facefusion/processors/modules/face_swapper/core.py
#   facefusion/processors/modules/face_enhancer/core.py
#   facefusion/processors/modules/expression_restorer/core.py
#   facefusion/face_analyser.py
#
# Pattern: github.com/facefusion/facefusion-assets/releases/download/{tag}/{file}
# ═══════════════════════════════════════════════════════════════════════

RUN mkdir -p /app/.assets/models

# GitHub base URL for facefusion-assets releases
ENV GH=https://github.com/facefusion/facefusion-assets/releases/download

# ─── 1. Face Analyser — core detection & landmark models ─────────────
# (Required by all processors — always loaded first)
RUN curl -fSL -o /app/.assets/models/yoloface_8n.onnx           ${GH}/models-3.0.0/yoloface_8n.onnx && \
    curl -fSL -o /app/.assets/models/yoloface_8n.hash           ${GH}/models-3.0.0/yoloface_8n.hash && \
    curl -fSL -o /app/.assets/models/2dfan4.onnx                ${GH}/models-3.0.0/2dfan4.onnx && \
    curl -fSL -o /app/.assets/models/2dfan4.hash                ${GH}/models-3.0.0/2dfan4.hash && \
    curl -fSL -o /app/.assets/models/arcface_w600k_r50.onnx     ${GH}/models-3.0.0/arcface_w600k_r50.onnx && \
    curl -fSL -o /app/.assets/models/arcface_w600k_r50.hash     ${GH}/models-3.0.0/arcface_w600k_r50.hash && \
    curl -fSL -o /app/.assets/models/fairface.onnx              ${GH}/models-3.0.0/fairface.onnx && \
    curl -fSL -o /app/.assets/models/fairface.hash              ${GH}/models-3.0.0/fairface.hash && \
    curl -fSL -o /app/.assets/models/fan_68_5.onnx              ${GH}/models-3.0.0/fan_68_5.onnx && \
    curl -fSL -o /app/.assets/models/fan_68_5.hash              ${GH}/models-3.0.0/fan_68_5.hash && \
    curl -fSL -o /app/.assets/models/bisenet_resnet_34.onnx     ${GH}/models-3.0.0/bisenet_resnet_34.onnx && \
    curl -fSL -o /app/.assets/models/bisenet_resnet_34.hash     ${GH}/models-3.0.0/bisenet_resnet_34.hash && \
    echo "✅ Face analyser models done"

# ─── 2. Face Swapper — hyperswap_1c_256 (primary) + inswapper (fallback) ──
# Source: face_swapper/core.py → models-3.3.0 for hyperswap, models-3.0.0 for inswapper
RUN curl -fSL -o /app/.assets/models/hyperswap_1c_256.onnx     ${GH}/models-3.3.0/hyperswap_1c_256.onnx && \
    curl -fSL -o /app/.assets/models/hyperswap_1c_256.hash     ${GH}/models-3.3.0/hyperswap_1c_256.hash && \
    curl -fSL -o /app/.assets/models/inswapper_128_fp16.onnx   ${GH}/models-3.0.0/inswapper_128_fp16.onnx && \
    curl -fSL -o /app/.assets/models/inswapper_128_fp16.hash   ${GH}/models-3.0.0/inswapper_128_fp16.hash && \
    echo "✅ Face swapper models done"

# ─── 3. Face Enhancer — gfpgan_1.4 ──────────────────────────────────
# Source: face_enhancer/core.py → models-3.0.0
RUN curl -fSL -o /app/.assets/models/gfpgan_1.4.onnx           ${GH}/models-3.0.0/gfpgan_1.4.onnx && \
    curl -fSL -o /app/.assets/models/gfpgan_1.4.hash           ${GH}/models-3.0.0/gfpgan_1.4.hash && \
    echo "✅ Face enhancer model done"

# ─── 4. Expression Restorer — live_portrait (3 sub-models) ──────────
# Source: expression_restorer/core.py → models-3.0.0
# LivePortrait uses 3 onnx files: feature_extractor, motion_extractor, generator
RUN curl -fSL -o /app/.assets/models/live_portrait_feature_extractor.onnx   ${GH}/models-3.0.0/live_portrait_feature_extractor.onnx && \
    curl -fSL -o /app/.assets/models/live_portrait_feature_extractor.hash   ${GH}/models-3.0.0/live_portrait_feature_extractor.hash && \
    curl -fSL -o /app/.assets/models/live_portrait_motion_extractor.onnx    ${GH}/models-3.0.0/live_portrait_motion_extractor.onnx && \
    curl -fSL -o /app/.assets/models/live_portrait_motion_extractor.hash    ${GH}/models-3.0.0/live_portrait_motion_extractor.hash && \
    curl -fSL -o /app/.assets/models/live_portrait_generator.onnx           ${GH}/models-3.0.0/live_portrait_generator.onnx && \
    curl -fSL -o /app/.assets/models/live_portrait_generator.hash           ${GH}/models-3.0.0/live_portrait_generator.hash && \
    echo "✅ Expression restorer (LivePortrait) models done"

# ─── 5. Miscellaneous — parsing, content moderation ─────────────────
RUN curl -fSL -o /app/.assets/models/xseg_1.onnx               ${GH}/models-3.1.0/xseg_1.onnx && \
    curl -fSL -o /app/.assets/models/xseg_1.hash               ${GH}/models-3.1.0/xseg_1.hash && \
    curl -fSL -o /app/.assets/models/kim_vocal_2.onnx           ${GH}/models-3.0.0/kim_vocal_2.onnx && \
    curl -fSL -o /app/.assets/models/kim_vocal_2.hash           ${GH}/models-3.0.0/kim_vocal_2.hash && \
    curl -fSL -o /app/.assets/models/nsfw_1.onnx                ${GH}/models-3.3.0/nsfw_1.onnx && \
    curl -fSL -o /app/.assets/models/nsfw_2.onnx                ${GH}/models-3.3.0/nsfw_2.onnx && \
    curl -fSL -o /app/.assets/models/nsfw_3.onnx                ${GH}/models-3.3.0/nsfw_3.onnx && \
    echo "✅ Miscellaneous models done"

# ─── Verify ALL models ───────────────────────────────────────────────
RUN python -c "\
import os, glob; \
files = glob.glob('/app/.assets/models/*.onnx'); \
assert len(files) >= 15, f'Expected 15+ models, found {len(files)}'; \
total = 0; \
[( \
    print(f'  ✅ {os.path.basename(f)}: {os.path.getsize(f)/1024/1024:.1f}MB'), \
    total := total + os.path.getsize(f) \
) for f in sorted(files)]; \
hashes = glob.glob('/app/.assets/models/*.hash'); \
print(f'🎯 {len(files)} models + {len(hashes)} hashes = {len(files)+len(hashes)} files. Total: {total/1024/1024:.0f}MB')"

# ─── Copy handler ────────────────────────────────────────────────────
COPY runpod/handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
