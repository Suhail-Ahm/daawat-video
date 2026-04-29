FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

# System dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip git ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone FaceFusion
RUN git clone https://github.com/facefusion/facefusion /app/facefusion

# Install Python dependencies
RUN pip3 install --no-cache-dir -r /app/facefusion/requirements.txt && \
    pip3 uninstall -y onnxruntime 2>/dev/null; \
    pip3 install --no-cache-dir onnxruntime-gpu runpod requests

# Copy handler
COPY handler.py /app/handler.py

# Expose port for health checks
EXPOSE 8080

CMD ["python3", "/app/handler.py"]
