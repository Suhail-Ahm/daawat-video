"""
MINIMAL test handler — verifies RunPod infrastructure works.
Replace with handler.py once this test passes.

Build: docker build -t suhail30/facefusion-worker:test -f Dockerfile.test .
Push:  docker push suhail30/facefusion-worker:test
"""

import runpod
import os
import subprocess

def handler(event):
    """Simple echo handler to verify RunPod connectivity."""
    job_input = event.get("input", {})
    
    # Check GPU availability
    gpu_check = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
        capture_output=True, text=True
    )
    
    # Check if FaceFusion exists
    ff_exists = os.path.exists("/app/facefusion/facefusion.py")
    
    return {
        "status": "success",
        "message": "RunPod handler is working!",
        "gpu": gpu_check.stdout.strip() if gpu_check.returncode == 0 else "No GPU found",
        "facefusion_installed": ff_exists,
        "python_version": subprocess.run(["python3", "--version"], capture_output=True, text=True).stdout.strip(),
        "input_received": job_input,
    }

runpod.serverless.start({"handler": handler})
