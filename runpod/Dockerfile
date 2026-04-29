FROM runpod/base:0.6.2-cuda12.1.0

ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# System dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Identify which Python to use (runpod/base has multiple) ───────────
# Find the correct python and lock to it
RUN PYTHON_BIN=$(which python3) && \
    echo "Using Python: $PYTHON_BIN" && \
    $PYTHON_BIN --version && \
    ln -sf $PYTHON_BIN /usr/local/bin/python_worker

# ─── Clone FaceFusion ──────────────────────────────────────────────────
RUN git clone https://github.com/facefusion/facefusion /app/facefusion

# ─── Install ALL Python deps using the SAME interpreter ────────────────
# 1. FaceFusion deps (install onnxruntime first, then replace with GPU)
# 2. RunPod handler deps (install LAST to prevent overwrite)
RUN python_worker -m pip install --no-cache-dir --upgrade pip && \
    python_worker -m pip install --no-cache-dir \
        numpy==2.2.1 \
        onnx==1.21.0 \
        opencv-python==4.13.0.92 \
        tqdm==4.67.3 \
        scipy==1.17.1 && \
    python_worker -m pip install --no-cache-dir onnxruntime-gpu && \
    python_worker -m pip install --no-cache-dir runpod requests

# ─── Verify ALL critical imports work ──────────────────────────────────
RUN python_worker -c "\
import runpod; print('✅ runpod', runpod.__version__); \
import requests; print('✅ requests OK'); \
import cv2; print('✅ opencv', cv2.__version__); \
import numpy; print('✅ numpy', numpy.__version__); \
import onnxruntime; print('✅ onnxruntime', onnxruntime.__version__); \
print('Available providers:', onnxruntime.get_available_providers())"

# Copy handler
COPY handler.py /app/handler.py

CMD ["python_worker", "-u", "/app/handler.py"]
