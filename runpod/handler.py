"""
FaceFusion Serverless Handler for RunPod
Receives S3 URLs, performs face swap + enhancement, uploads result back to S3
"""

import runpod
import subprocess
import requests
import tempfile
import os
import time
import shutil

FACEFUSION_DIR = "/app"


def download_file(url: str, path: str):
    """Download a file from URL to local path."""
    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()
    with open(path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"  Downloaded: {path} ({os.path.getsize(path) / 1024 / 1024:.1f} MB)")


def upload_file(path: str, upload_url: str):
    """Upload result to a presigned S3 URL."""
    with open(path, "rb") as f:
        response = requests.put(
            upload_url,
            data=f,
            headers={"Content-Type": "video/mp4"},
            timeout=300,
        )
        response.raise_for_status()
    print(f"  Uploaded: {path} ({os.path.getsize(path) / 1024 / 1024:.1f} MB)")


def handler(event):
    job_input = event["input"]

    source_url = job_input["source_url"]
    target_url = job_input["target_url"]
    upload_url = job_input.get("upload_url")
    gender = job_input.get("gender", "female")

    work_dir = tempfile.mkdtemp()
    source_path = os.path.join(work_dir, "source.png")
    target_path = os.path.join(work_dir, "target.mp4")
    output_path = os.path.join(work_dir, "output.mp4")

    try:
        # Download inputs
        print("Downloading inputs...")
        download_file(source_url, source_path)
        download_file(target_url, target_path)

        # Run FaceFusion
        print("Running FaceFusion...")
        start = time.time()

        cmd = [
            "python",
            "facefusion.py",
            "headless-run",
            "--source-paths", source_path,
            "--target-path", target_path,
            "--output-path", output_path,
            # ── Processors: swap → enhance → restore expressions ──
            "--processors", "face_swapper", "face_enhancer", "expression_restorer",
            "--execution-providers", "cuda",
            # ── Face detection ──
            "--face-selector-mode", "many",
            "--face-selector-gender", gender,
            # ── Face swapper: inswapper + 512x pixel boost for sharp faces ──
            "--face-swapper-model", "hyperswap_1c_256",
            "--face-swapper-pixel-boost", "512x512",
            # ── Face enhancer: GFPGAN 1.4 at 80% blend (natural skin, no plastic look) ──
            "--face-enhancer-model", "gfpgan_1.4",
            "--face-enhancer-blend", "80",
            # ── Expression restorer: LivePortrait (preserves talking, blinking, emotions) ──
            "--expression-restorer-model", "live_portrait",
            # ── Execution ──
            "--execution-thread-count", "4",
            "--video-memory-strategy", "tolerant",
            # ── Output: high quality encoding ──
            "--output-video-encoder", "libx264",
            "--output-video-quality", "85",
        ]

        print(f"  CMD: {' '.join(cmd)}")

        # Stream output live so RunPod logs capture FaceFusion progress
        process = subprocess.Popen(
            cmd,
            cwd=FACEFUSION_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        output_lines = []
        for line in process.stdout:
            line = line.rstrip()
            print(f"  [FF] {line}")
            output_lines.append(line)

        process.wait(timeout=600)

        elapsed = time.time() - start

        if process.returncode != 0:
            return {
                "status": "error",
                "error": "\n".join(output_lines[-20:]),
                "elapsed": elapsed,
            }

        if not os.path.exists(output_path):
            return {
                "status": "error",
                "error": "Output file not created",
                "elapsed": elapsed,
            }

        # Upload output
        if upload_url:
            print("Uploading result...")
            upload_file(output_path, upload_url)

        return {
            "status": "success",
            "elapsed": round(elapsed, 1),
            "output_size_mb": round(os.path.getsize(output_path) / 1024 / 1024, 1),
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


runpod.serverless.start({"handler": handler})
