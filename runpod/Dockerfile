FROM runpod/base:0.6.2-cuda12.1.0

ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# System dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first
RUN pip3 install --no-cache-dir runpod requests

# Clone FaceFusion
RUN git clone https://github.com/facefusion/facefusion /app/facefusion

# Install FaceFusion dependencies
RUN cd /app/facefusion && \
    pip3 install --no-cache-dir -r requirements.txt && \
    pip3 uninstall -y onnxruntime 2>/dev/null; \
    pip3 install --no-cache-dir onnxruntime-gpu

# Copy handler
COPY handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
