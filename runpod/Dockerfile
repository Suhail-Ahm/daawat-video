FROM runpod/base:0.6.2-cuda12.1.0

ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# ─── System deps ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Identify and lock the Python interpreter ──────────────────────────
# runpod/base ships multiple Python versions (3.10, 3.11).
# We must use the SAME one for pip and runtime.
RUN echo "=== Available Pythons ===" && \
    ls -la /usr/bin/python* && \
    echo "=== python3 resolves to ===" && \
    readlink -f $(which python3) && \
    echo "=== Version ===" && \
    python3 --version

# ─── Clone FaceFusion (pin a specific commit for reproducibility) ──────
RUN git clone https://github.com/facefusion/facefusion /app/facefusion

# ─── Install FaceFusion deps (skip gradio, not needed for headless) ────
# Using python3 -m pip ensures we install to the SAME python3 interpreter
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir \
        numpy==2.2.1 \
        onnx==1.21.0 \
        opencv-python==4.13.0.92 \
        tqdm==4.67.3 \
        scipy==1.15.3

# ─── Install onnxruntime-gpu (replaces CPU version from requirements) ──
RUN python3 -m pip install --no-cache-dir onnxruntime-gpu

# ─── Install RunPod SDK + requests LAST (prevents dep overwrites) ──────
RUN python3 -m pip install --no-cache-dir --force-reinstall runpod requests

# ─── Pre-download FaceFusion models at build time ──────────────────────
# First, check what FaceFusion version/CLI we have
RUN cd /app/facefusion && \
    echo "=== FaceFusion directory ===" && \
    ls -la && \
    echo "=== Checking CLI help ===" && \
    python3 facefusion.py --help 2>&1 | head -40 || true

# Download models: try force-download first, fallback to direct URLs
RUN cd /app/facefusion && \
    mkdir -p .assets/models && \
    (python3 facefusion.py force-download \
        --processors face_swapper face_enhancer \
        --face-swapper-model inswapper_128 \
        --face-enhancer-model gfpgan_1.4 2>&1 && \
     echo "force-download completed") || \
    echo "force-download failed, trying direct downloads..." && \
    if [ $(find /app/facefusion -name "*.onnx" | wc -l) -lt 2 ]; then \
        echo "Downloading models directly..." && \
        wget -q --show-progress -O .assets/models/inswapper_128.onnx \
            "https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/inswapper_128.onnx" && \
        wget -q --show-progress -O .assets/models/gfpgan_1.4.onnx \
            "https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/gfpgan_1.4.onnx" && \
        echo "Direct download completed"; \
    fi && \
    echo "=== Models present ===" && \
    find /app/facefusion -name "*.onnx" -exec ls -lh {} \;

# ─── Verify ALL critical imports at build time ─────────────────────────
# If any import fails, the BUILD fails → instant feedback on Windows
RUN python3 -c "\
import sys; print('Python:', sys.executable, sys.version); \
import runpod; print('✅ runpod', runpod.__version__); \
import requests; print('✅ requests OK'); \
import cv2; print('✅ opencv', cv2.__version__); \
import numpy; print('✅ numpy', numpy.__version__); \
import onnxruntime; print('✅ onnxruntime', onnxruntime.__version__); \
print('   Providers:', onnxruntime.get_available_providers()); \
import tqdm; print('✅ tqdm OK'); \
import scipy; print('✅ scipy OK'); \
print('\\n🎯 All imports verified!')"

# ─── Verify models were downloaded ────────────────────────────────────
RUN python3 <<'PYEOF'
import os, glob
onnx_files = glob.glob('/app/facefusion/.assets/**/*.onnx', recursive=True)
if not onnx_files:
    onnx_files = glob.glob('/app/facefusion/**/*.onnx', recursive=True)
assert len(onnx_files) >= 2, f'Expected 2+ models, found {len(onnx_files)}'
for f in sorted(onnx_files):
    size = os.path.getsize(f) / 1024 / 1024
    print(f'✅ {os.path.basename(f)}: {size:.1f} MB')
print(f'\n🎯 {len(onnx_files)} models present!')
PYEOF

# ─── Copy handler ─────────────────────────────────────────────────────
COPY handler.py /app/handler.py

# ─── Use python3 -u for unbuffered stdout (shows in RunPod logs) ──────
CMD ["python3", "-u", "/app/handler.py"]
