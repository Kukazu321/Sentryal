#!/usr/bin/env python3
"""
SENTRYAL - RunPod Serverless Handler
=====================================
Ce handler reçoit les jobs InSAR depuis le backend Sentryal
et orchestre le traitement ISCE3.

Architecture:
    Backend (Railway) -> RunPod Serverless API -> Ce Handler -> ISCE3
    
Format d'entrée (job_input):
{
    "job_id": "uuid",
    "infrastructure_id": "uuid",
    "reference_granule": "S1A_..._SAFE.zip",
    "secondary_granule": "S1A_..._SAFE.zip",
    "reference_url": "https://...",  # URL de téléchargement ASF
    "secondary_url": "https://...",
    "bbox": {
        "north": 45.0,
        "south": 44.0,
        "east": 5.0,
        "west": 4.0
    },
    "points": [  # Points où extraire les déplacements
        {"id": "uuid", "lat": 44.5, "lon": 4.5},
        ...
    ],
    "webhook_url": "https://api.sentryal.com/webhook/insar"  # Pour notifier le résultat
}

Format de sortie:
{
    "job_id": "uuid",
    "status": "success" | "error",
    "results": {
        "interferogram_url": "https://storage...",
        "coherence_url": "https://storage...",
        "displacement_points": [
            {"point_id": "uuid", "displacement_mm": -5.2, "coherence": 0.85},
            ...
        ],
        "statistics": {...}
    },
    "processing_time_seconds": 120,
    "error": null | "message"
}
"""

import os
import sys
import json
import time
import traceback
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

import runpod

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("sentryal-handler")

# Import our ISCE3 processor
from isce3_processor import ISCE3Processor
from utils import download_granule, upload_results, notify_webhook, extract_displacement_at_points

# ============================================================================
# Configuration
# ============================================================================
WORK_DIR = Path("/data")
INPUT_DIR = WORK_DIR / "input"
OUTPUT_DIR = WORK_DIR / "output"
DEM_DIR = WORK_DIR / "dem"
LOGS_DIR = WORK_DIR / "logs"

# Create directories
for d in [INPUT_DIR, OUTPUT_DIR, DEM_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ============================================================================
# Main Handler
# ============================================================================
def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Point d'entrée principal pour RunPod Serverless.
    Traite un job InSAR complet.
    """
    start_time = time.time()
    job_input = job.get("input", {})
    job_id = job_input.get("job_id", "unknown")
    
    logger.info(f"=" * 80)
    logger.info(f"Starting InSAR job: {job_id}")
    logger.info(f"=" * 80)
    
    try:
        # Validate input
        validation_result = validate_input(job_input)
        if not validation_result["valid"]:
            raise ValueError(f"Invalid input: {validation_result['error']}")
        
        # Create job-specific directories
        job_work_dir = OUTPUT_DIR / job_id
        job_work_dir.mkdir(parents=True, exist_ok=True)
        
        # Step 1: Download SAR granules
        logger.info("Step 1: Downloading SAR granules from ASF...")
        
        ref_path = download_granule(
            url=job_input["reference_url"],
            granule_name=job_input["reference_granule"],
            output_dir=INPUT_DIR
        )
        logger.info(f"  ✓ Reference downloaded: {ref_path}")
        
        sec_path = download_granule(
            url=job_input["secondary_url"],
            granule_name=job_input["secondary_granule"],
            output_dir=INPUT_DIR
        )
        logger.info(f"  ✓ Secondary downloaded: {sec_path}")
        
        # Step 2: Initialize ISCE3 processor
        logger.info("Step 2: Initializing ISCE3 processor...")
        processor = ISCE3Processor(
            work_dir=str(job_work_dir),
            dem_dir=str(DEM_DIR)
        )
        
        # Step 3: Run ISCE3 processing pipeline
        logger.info("Step 3: Running ISCE3 InSAR processing...")
        bbox = job_input.get("bbox", {})
        
        processing_result = processor.process_pair(
            reference_safe=str(ref_path),
            secondary_safe=str(sec_path),
            bbox={
                "north": bbox.get("north", 90),
                "south": bbox.get("south", -90),
                "east": bbox.get("east", 180),
                "west": bbox.get("west", -180)
            }
        )
        
        if not processing_result["success"]:
            raise RuntimeError(f"ISCE3 processing failed: {processing_result.get('error')}")
        
        logger.info(f"  ✓ Processing complete")
        logger.info(f"    - Interferogram: {processing_result.get('interferogram')}")
        logger.info(f"    - Coherence: {processing_result.get('coherence')}")
        
        # Step 4: Extract displacement at infrastructure points
        logger.info("Step 4: Extracting displacement at points...")
        points = job_input.get("points", [])
        
        displacement_results = []
        if points and processing_result.get("displacement"):
            displacement_results = extract_displacement_at_points(
                displacement_raster=processing_result["displacement"],
                coherence_raster=processing_result.get("coherence"),
                points=points
            )
            logger.info(f"  ✓ Extracted {len(displacement_results)} point measurements")
        
        # Step 5: Upload results to storage (optional - if storage configured)
        logger.info("Step 5: Preparing results...")
        
        result_urls = {}
        storage_bucket = os.environ.get("STORAGE_BUCKET")
        if storage_bucket:
            logger.info(f"  Uploading to {storage_bucket}...")
            result_urls = upload_results(
                job_id=job_id,
                processing_result=processing_result,
                bucket=storage_bucket
            )
        else:
            # Return file paths (for local/debug)
            result_urls = {
                "interferogram": processing_result.get("interferogram"),
                "coherence": processing_result.get("coherence"),
                "displacement": processing_result.get("displacement"),
                "unwrapped": processing_result.get("unwrapped")
            }
        
        # Calculate statistics
        stats = processing_result.get("statistics", {})
        
        processing_time = time.time() - start_time
        
        # Build response
        response = {
            "job_id": job_id,
            "status": "success",
            "results": {
                "interferogram_url": result_urls.get("interferogram"),
                "coherence_url": result_urls.get("coherence"),
                "displacement_url": result_urls.get("displacement"),
                "displacement_points": displacement_results,
                "statistics": {
                    "mean_coherence": stats.get("mean_coherence"),
                    "mean_displacement_mm": stats.get("mean_displacement_mm"),
                    "min_displacement_mm": stats.get("min_displacement_mm"),
                    "max_displacement_mm": stats.get("max_displacement_mm"),
                    "valid_points": len([p for p in displacement_results if p.get("valid", False)])
                }
            },
            "processing_time_seconds": round(processing_time, 2),
            "error": None
        }
        
        # Step 6: Notify webhook (if configured)
        webhook_url = job_input.get("webhook_url")
        if webhook_url:
            logger.info(f"Step 6: Notifying webhook...")
            notify_webhook(webhook_url, response)
        
        logger.info(f"=" * 80)
        logger.info(f"Job {job_id} completed successfully in {processing_time:.1f}s")
        logger.info(f"=" * 80)
        
        return response
        
    except Exception as e:
        processing_time = time.time() - start_time
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        logger.error(f"Job {job_id} failed: {error_msg}")
        logger.error(error_trace)
        
        response = {
            "job_id": job_id,
            "status": "error",
            "results": None,
            "processing_time_seconds": round(processing_time, 2),
            "error": error_msg,
            "error_trace": error_trace
        }
        
        # Notify webhook of failure
        webhook_url = job_input.get("webhook_url")
        if webhook_url:
            try:
                notify_webhook(webhook_url, response)
            except:
                pass
        
        return response
    
    finally:
        # Cleanup temporary files
        cleanup_job(job_id)


def validate_input(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """Validate job input parameters."""
    required_fields = ["job_id", "reference_granule", "secondary_granule"]
    
    # Check URL fields (at least one way to get granules)
    has_urls = job_input.get("reference_url") and job_input.get("secondary_url")
    has_paths = job_input.get("reference_path") and job_input.get("secondary_path")
    
    for field in required_fields:
        if not job_input.get(field):
            return {"valid": False, "error": f"Missing required field: {field}"}
    
    if not has_urls and not has_paths:
        return {"valid": False, "error": "Must provide either URLs or paths for granules"}
    
    return {"valid": True}


def cleanup_job(job_id: str):
    """Clean up temporary files after job completion."""
    try:
        import shutil
        job_dir = OUTPUT_DIR / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)
            logger.info(f"Cleaned up job directory: {job_dir}")
    except Exception as e:
        logger.warning(f"Failed to cleanup job {job_id}: {e}")


# ============================================================================
# RunPod Entry Point
# ============================================================================
if __name__ == "__main__":
    logger.info("=" * 80)
    logger.info("SENTRYAL InSAR Processing Server - Starting")
    logger.info("=" * 80)
    
    # Verify ISCE3 installation
    try:
        import isce3
        logger.info(f"✓ ISCE3 version: {isce3.__version__}")
    except ImportError as e:
        logger.error(f"✗ ISCE3 not available: {e}")
        sys.exit(1)
    
    # Start RunPod handler
    runpod.serverless.start({"handler": handler})
