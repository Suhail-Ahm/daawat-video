"""
Character Swap Handler Wrapper for RunPod + ComfyUI

Receives the same input format as the FaceFusion handler:
  {source_url, target_url, upload_url, gender}

Translates it into a ComfyUI workflow_api.json request that:
1. Loads the target video
2. Segments the woman using SAM 2 (hard-coded points)
3. Encodes the source selfie via CLIP Vision
4. Runs Wan 2.2 Animate to replace the woman region
5. Uploads output video to S3
"""

import runpod
import requests
import subprocess
import tempfile
import shutil
import os
import json
import time
import base64
import glob


WORKFLOW_PATH = "/workflow_api.json"
COMFY_OUTPUT_DIR = "/comfyui/output"


def download_file(url: str, path: str):
    """Download a file from URL to local path."""
    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()
    with open(path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    size_mb = os.path.getsize(path) / 1024 / 1024
    print(f"  Downloaded: {path} ({size_mb:.1f} MB)")


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
    size_mb = os.path.getsize(path) / 1024 / 1024
    print(f"  Uploaded: {path} ({size_mb:.1f} MB)")


def image_to_base64(path: str) -> str:
    """Convert an image file to base64 data URI."""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    ext = os.path.splitext(path)[1].lower().strip(".")
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{data}"


def prepare_workflow(source_path: str, target_path: str) -> dict:
    """
    Load the workflow_api.json template and inject:
    - Source selfie as base64 image
    - Target video path
    """
    with open(WORKFLOW_PATH, "r") as f:
        workflow = json.load(f)

    # Inject the source selfie as base64 into the CLIP Vision Encode node
    source_b64 = image_to_base64(source_path)

    # Inject the target video path into the VHS_LoadVideo node
    # The workflow JSON uses node IDs — we set the paths dynamically
    for node_id, node in workflow.items():
        class_type = node.get("class_type", "")

        # Set target video path in VHS_LoadVideo node
        if class_type == "VHS_LoadVideo":
            node["inputs"]["video"] = target_path
            print(f"  Set target video: {target_path}")

        # Set source image in LoadImage node (for CLIP Vision encoding)
        if class_type == "LoadImage" and "source" in node.get("_meta", {}).get("title", "").lower():
            node["inputs"]["image"] = os.path.basename(source_path)
            print(f"  Set source image: {os.path.basename(source_path)}")

    return workflow


def find_output_video() -> str:
    """Find the latest output video from ComfyUI output directory."""
    patterns = [
        os.path.join(COMFY_OUTPUT_DIR, "**", "*.mp4"),
        os.path.join(COMFY_OUTPUT_DIR, "**", "*.webm"),
    ]
    all_files = []
    for pattern in patterns:
        all_files.extend(glob.glob(pattern, recursive=True))

    if not all_files:
        raise FileNotFoundError(f"No video output found in {COMFY_OUTPUT_DIR}")

    # Return the most recently modified video
    return max(all_files, key=os.path.getmtime)


def handler(event):
    job_input = event["input"]

    source_url = job_input["source_url"]
    target_url = job_input["target_url"]
    upload_url = job_input.get("upload_url")

    work_dir = tempfile.mkdtemp()
    source_path = os.path.join(work_dir, "source.png")
    target_path = os.path.join(work_dir, "target.mp4")

    try:
        # ── Step 1: Download inputs ──
        print("Downloading inputs...")
        download_file(source_url, source_path)
        download_file(target_url, target_path)

        # Copy source image to ComfyUI input dir so LoadImage can find it
        comfy_input_dir = "/comfyui/input"
        os.makedirs(comfy_input_dir, exist_ok=True)
        shutil.copy2(source_path, os.path.join(comfy_input_dir, "source.png"))

        # ── Step 2: Verify models on Network Volume ──
        print("=== MODEL CHECK ===")
        volume_models = "/runpod-volume/models"
        if os.path.isdir(volume_models):
            for root, dirs, files in os.walk(volume_models):
                for f in files:
                    fpath = os.path.join(root, f)
                    size_mb = os.path.getsize(fpath) / 1024 / 1024
                    rel = os.path.relpath(fpath, volume_models)
                    print(f"  ✅ {rel}: {size_mb:.1f} MB")
        else:
            print(f"  ❌ Network Volume not mounted at {volume_models}")
            return {"status": "error", "error": "Network Volume not mounted"}

        # Symlink Network Volume models into ComfyUI model paths
        model_mappings = {
            "diffusion_models": "/comfyui/models/diffusion_models",
            "clip": "/comfyui/models/clip",
            "vae": "/comfyui/models/vae",
            "sam2": "/comfyui/models/sam2",
        }
        for src_dir, dst_dir in model_mappings.items():
            src = os.path.join(volume_models, src_dir)
            if os.path.isdir(src):
                # Symlink each file in the source dir into the dest dir
                for fname in os.listdir(src):
                    src_file = os.path.join(src, fname)
                    dst_file = os.path.join(dst_dir, fname)
                    if not os.path.exists(dst_file):
                        os.symlink(src_file, dst_file)
                        print(f"  Linked: {fname} → {dst_dir}")
        print("=== END MODEL CHECK ===")

        # ── Step 3: Prepare and run workflow ──
        print("Preparing ComfyUI workflow...")
        workflow = prepare_workflow(source_path, target_path)

        # Clear previous outputs
        if os.path.isdir(COMFY_OUTPUT_DIR):
            for f in os.listdir(COMFY_OUTPUT_DIR):
                fpath = os.path.join(COMFY_OUTPUT_DIR, f)
                if os.path.isfile(fpath):
                    os.remove(fpath)

        print("Running ComfyUI workflow...")
        start = time.time()

        # Submit workflow to ComfyUI's internal API
        # The worker-comfyui base image runs ComfyUI on port 8188
        response = requests.post(
            "http://127.0.0.1:8188/prompt",
            json={"prompt": workflow},
            timeout=600,
        )
        response.raise_for_status()
        prompt_data = response.json()
        prompt_id = prompt_data.get("prompt_id")
        print(f"  Prompt submitted: {prompt_id}")

        # Poll for completion
        max_wait = 600  # 10 minutes
        poll_interval = 5
        elapsed = 0
        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed = time.time() - start

            # Check history for completion
            hist_resp = requests.get(
                f"http://127.0.0.1:8188/history/{prompt_id}",
                timeout=30,
            )
            if hist_resp.status_code == 200:
                history = hist_resp.json()
                if prompt_id in history:
                    status = history[prompt_id].get("status", {})
                    if status.get("completed", False):
                        print(f"  Workflow completed in {elapsed:.1f}s")
                        break
                    if status.get("status_str") == "error":
                        error_msg = str(status.get("messages", "Unknown error"))
                        return {"status": "error", "error": error_msg, "elapsed": elapsed}

            print(f"  Waiting... ({elapsed:.0f}s)")

        total_elapsed = time.time() - start

        # ── Step 4: Find and upload output ──
        output_path = find_output_video()
        print(f"  Output video: {output_path}")
        output_size = os.path.getsize(output_path) / 1024 / 1024

        if upload_url:
            print("Uploading result...")
            upload_file(output_path, upload_url)

        return {
            "status": "success",
            "elapsed": round(total_elapsed, 1),
            "output_size_mb": round(output_size, 1),
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


runpod.serverless.start({"handler": handler})
