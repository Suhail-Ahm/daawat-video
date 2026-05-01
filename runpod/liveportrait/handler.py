"""
LivePortrait RunPod Serverless Handler

Receives the same input format as our FaceFusion handler:
  {source_url, target_url, upload_url, gender}

Uses LivePortrait to animate the source face with driving video expressions,
then uploads the output to S3 via presigned URL.

Key flags for Daawat scene:
  - flag_pasteback = True  → composites face back into full frame (body/clothing unchanged)
  - flag_stitching = True  → smooths the seam at face boundary
  - flag_relative_motion = True → transfers expression deltas (preserves source identity)
  - flag_crop_driving_video = True → handles two-person frames (tracks female face only)
"""

import os
import sys
import time
import tempfile
import traceback
import shutil
from pathlib import Path

import runpod
import requests

# ─── Add LivePortrait to path ────────────────────────────────────────
sys.path.insert(0, "/app/LivePortrait")

from src.config.argument_config import ArgumentConfig
from src.config.inference_config import InferenceConfig
from src.config.crop_config import CropConfig
from src.live_portrait_pipeline import LivePortraitPipeline


# ─── partial_fields: filter kwargs to only fields the dataclass accepts ──
# This was in inference.py, NOT in src.utils.helper (despite what the PDF said)
def partial_fields(target_class, kwargs):
    return target_class(**{k: v for k, v in kwargs.items() if hasattr(target_class, k)})


# ─── Load models ONCE on worker boot ─────────────────────────────────
MODEL_DIR = os.environ.get("LIVEPORTRAIT_MODEL_DIR", "/runpod-volume/pretrained_weights/liveportrait")
INSIGHTFACE_DIR = os.environ.get("INSIGHTFACE_MODEL_DIR", "/runpod-volume/pretrained_weights/insightface")

# Build configs from default ArgumentConfig
_default_args = ArgumentConfig()
_default_args.flag_pasteback = True
_default_args.flag_stitching = True
_default_args.flag_relative_motion = True
_default_args.flag_crop_driving_video = True

inference_cfg = partial_fields(InferenceConfig, _default_args.__dict__)
crop_cfg = partial_fields(CropConfig, _default_args.__dict__)

# Override checkpoint paths → network volume
# InferenceConfig checkpoints (verified from inference_config.py)
inference_cfg.checkpoint_F = f"{MODEL_DIR}/base_models/appearance_feature_extractor.pth"
inference_cfg.checkpoint_M = f"{MODEL_DIR}/base_models/motion_extractor.pth"
inference_cfg.checkpoint_W = f"{MODEL_DIR}/base_models/warping_module.pth"
inference_cfg.checkpoint_G = f"{MODEL_DIR}/base_models/spade_generator.pth"
inference_cfg.checkpoint_S = f"{MODEL_DIR}/retargeting_models/stitching_retargeting_module.pth"

# CropConfig paths (verified from crop_config.py) — these default to
# relative paths that won't exist in the container
crop_cfg.insightface_root = INSIGHTFACE_DIR
crop_cfg.landmark_ckpt_path = f"{MODEL_DIR}/landmark.onnx"

print("[boot] Initializing LivePortrait pipeline...")
print(f"  Model dir: {MODEL_DIR}")
print(f"  InsightFace dir: {INSIGHTFACE_DIR}")
print(f"  Landmark: {crop_cfg.landmark_ckpt_path}")
print(f"  Checkpoint F: {inference_cfg.checkpoint_F}")

pipeline = LivePortraitPipeline(inference_cfg=inference_cfg, crop_cfg=crop_cfg)
print("[boot] Ready.")


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


def handler(event):
    """
    RunPod handler — same interface as FaceFusion handler:
      input.source_url  → selfie image (S3 presigned URL)
      input.target_url  → template video (S3 presigned URL)
      input.upload_url  → presigned PUT URL for output video
    """
    job_input = event.get("input", {}) or {}

    source_url = job_input.get("source_url")
    target_url = job_input.get("target_url")
    upload_url = job_input.get("upload_url")

    if not source_url or not target_url:
        return {"status": "error", "error": "source_url and target_url are required"}

    work_dir = tempfile.mkdtemp()

    try:
        start = time.time()

        # ── Step 1: Download inputs ──
        print("=== LIVEPORTRAIT HANDLER ===")
        source_path = os.path.join(work_dir, "source.png")
        target_path = os.path.join(work_dir, "target.mp4")

        print("Downloading source selfie...")
        download_file(source_url, source_path)
        print("Downloading target video...")
        download_file(target_url, target_path)

        # ── Step 2: Run LivePortrait ──
        print("Running LivePortrait pipeline...")
        out_dir = Path(work_dir) / "output"
        out_dir.mkdir(parents=True, exist_ok=True)

        args = ArgumentConfig()
        args.source = source_path
        args.driving = target_path
        args.output_dir = str(out_dir)
        args.flag_pasteback = True
        args.flag_stitching = True
        args.flag_relative_motion = True
        args.flag_crop_driving_video = True

        # pipeline.execute returns (wfp, wfp_concat)
        wfp, wfp_concat = pipeline.execute(args)

        elapsed = time.time() - start

        # Use the main output (wfp) — this is the pasteback version
        final_video = wfp
        if not os.path.exists(final_video):
            # Fallback: search for any mp4
            videos = sorted(out_dir.rglob("*.mp4"))
            if not videos:
                return {"status": "error", "error": "No output video produced"}
            # Prefer non-concat version
            paste_videos = [
                v for v in videos if "_concat" not in v.name
            ] or videos
            final_video = str(paste_videos[0])

        output_size = os.path.getsize(final_video) / 1024 / 1024
        print(f"  Output: {final_video} ({output_size:.1f} MB)")
        print(f"  Pipeline completed in {elapsed:.1f}s")

        # ── Step 3: Upload to S3 ──
        if upload_url:
            print("Uploading result to S3...")
            upload_file(final_video, upload_url)

        return {
            "status": "success",
            "elapsed": round(elapsed, 1),
            "output_size_mb": round(output_size, 1),
        }

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "error": str(e)}

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


runpod.serverless.start({"handler": handler})
