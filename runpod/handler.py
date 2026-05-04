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

        # Pre-flight: verify models exist
        print("=== MODEL PRE-FLIGHT CHECK ===")
        models_dir = os.path.join(FACEFUSION_DIR, ".assets", "models")
        required_models = [
            "hyperswap_1c_256.onnx",
            "gfpgan_1.4.onnx",
            "live_portrait_feature_extractor.onnx",
            "live_portrait_motion_extractor.onnx",
            "live_portrait_generator.onnx",
            "yoloface_8n.onnx",
            "2dfan4.onnx",
            "arcface_w600k_r50.onnx",
        ]
        for model in required_models:
            path = os.path.join(models_dir, model)
            if os.path.exists(path):
                size_mb = os.path.getsize(path) / 1024 / 1024
                print(f"  ✅ {model}: {size_mb:.1f} MB")
            else:
                print(f"  ❌ MISSING: {model}")
        # List all models actually present
        if os.path.isdir(models_dir):
            all_models = sorted(os.listdir(models_dir))
            print(f"  Total files in models dir: {len(all_models)}")
        else:
            print(f"  ❌ Models directory does not exist: {models_dir}")
        print("=== END PRE-FLIGHT ===")

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
            # ── Face detection — swap only the most prominent matching face ──
            "--face-selector-mode", "one",
            "--face-selector-gender", gender,
            # ── Face masking: region + occlusion for contour-following blending ──
            "--face-mask-types", "region", "occlusion",
            "--face-mask-blur", "0.3",
            "--face-mask-padding", "4", "8", "4", "4",
            # ── Face swapper: hyperswap_1c_256 (best identity fidelity) ──
            "--face-swapper-model", "hyperswap_1c_256",
            "--face-swapper-pixel-boost", "512x512",
            # ── Face enhancer: GFPGAN 1.4 — higher blend for sharper detail ──
            "--face-enhancer-model", "gfpgan_1.4",
            "--face-enhancer-blend", "60",
            "--face-enhancer-weight", "0.5",
            # ── Expression restorer: LivePortrait ──
            "--expression-restorer-model", "live_portrait",
            "--expression-restorer-factor", "80",
            # ── Execution ──
            "--execution-thread-count", "4",
            "--video-memory-strategy", "tolerant",
            # ── Output: maximum quality encoding ──
            "--output-video-encoder", "libx264",
            "--output-video-quality", "95",
            "--output-video-preset", "slow",
            # ── Diagnostics ──
            "--log-level", "debug",
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
