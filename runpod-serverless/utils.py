#!/usr/bin/env python3
"""
SENTRYAL - Utility Functions for InSAR Processing
==================================================
Functions for downloading, uploading, and processing InSAR data.
"""

import os
import sys
import json
import logging
import requests
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

import numpy as np

logger = logging.getLogger("sentryal-utils")


def download_granule(url: str, granule_name: str, output_dir: Path) -> Path:
    """
    Download a Sentinel-1 granule from ASF or provided URL.
    
    Args:
        url: Download URL (ASF DataPool or pre-signed)
        granule_name: Name of the granule (for filename)
        output_dir: Directory to save the file
        
    Returns:
        Path to downloaded file
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine output filename
    if granule_name.endswith('.zip'):
        filename = granule_name
    else:
        filename = f"{granule_name}.zip"
    
    output_path = output_dir / filename
    
    # Check if already downloaded
    if output_path.exists():
        logger.info(f"Granule already exists: {output_path}")
        return output_path
    
    logger.info(f"Downloading: {granule_name}")
    logger.info(f"  URL: {url[:80]}...")
    
    # Get ASF credentials from environment if needed
    asf_username = os.environ.get("ASF_USERNAME")
    asf_password = os.environ.get("ASF_PASSWORD")
    
    # Setup session
    session = requests.Session()
    
    if asf_username and asf_password:
        # Authenticate with ASF Earthdata Login
        auth_url = "https://urs.earthdata.nasa.gov/oauth/authorize"
        session.auth = (asf_username, asf_password)
    
    # Download with progress
    try:
        response = session.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # Log progress every 100MB
                    if total_size > 0 and downloaded % (100 * 1024 * 1024) < 8192:
                        pct = (downloaded / total_size) * 100
                        logger.info(f"  Progress: {pct:.1f}% ({downloaded / 1e6:.1f} MB)")
        
        logger.info(f"  Download complete: {output_path.name} ({downloaded / 1e6:.1f} MB)")
        return output_path
        
    except Exception as e:
        logger.error(f"Download failed: {e}")
        if output_path.exists():
            output_path.unlink()
        raise


def upload_results(
    job_id: str,
    processing_result: Dict[str, Any],
    bucket: str
) -> Dict[str, str]:
    """
    Upload processing results to cloud storage (S3/GCS).
    
    Args:
        job_id: Job identifier for organizing outputs
        processing_result: Dict with paths to output files
        bucket: Storage bucket name
        
    Returns:
        Dict with URLs to uploaded files
    """
    import boto3
    
    s3 = boto3.client('s3')
    urls = {}
    
    files_to_upload = [
        ("displacement", processing_result.get("displacement")),
        ("coherence", processing_result.get("coherence")),
        ("interferogram", processing_result.get("interferogram")),
        ("unwrapped", processing_result.get("unwrapped"))
    ]
    
    for name, filepath in files_to_upload:
        if filepath and Path(filepath).exists():
            key = f"results/{job_id}/{name}.tif"
            
            logger.info(f"Uploading {name} to s3://{bucket}/{key}")
            s3.upload_file(filepath, bucket, key)
            
            # Generate pre-signed URL (valid for 24h)
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=86400
            )
            urls[name] = url
    
    return urls


def notify_webhook(webhook_url: str, payload: Dict[str, Any]) -> bool:
    """
    Send job completion notification to webhook.
    
    Args:
        webhook_url: URL to POST results to
        payload: Job result data
        
    Returns:
        True if successful
    """
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        logger.info(f"Webhook notified successfully: {webhook_url}")
        return True
        
    except Exception as e:
        logger.error(f"Webhook notification failed: {e}")
        return False


def extract_displacement_at_points(
    displacement_raster: str,
    coherence_raster: Optional[str],
    points: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Extract displacement values at specific point locations.
    
    Args:
        displacement_raster: Path to displacement GeoTIFF
        coherence_raster: Path to coherence GeoTIFF (optional)
        points: List of {"id": "...", "lat": ..., "lon": ...}
        
    Returns:
        List of {"point_id": "...", "displacement_mm": ..., "coherence": ..., "valid": bool}
    """
    from osgeo import gdal
    
    results = []
    
    # Open displacement raster
    disp_ds = gdal.Open(displacement_raster)
    if not disp_ds:
        logger.error(f"Cannot open displacement raster: {displacement_raster}")
        return results
    
    disp_band = disp_ds.GetRasterBand(1)
    disp_data = disp_band.ReadAsArray()
    disp_nodata = disp_band.GetNoDataValue() or -9999
    
    # Get geotransform
    gt = disp_ds.GetGeoTransform()
    # gt = [originX, pixelWidth, 0, originY, 0, pixelHeight]
    
    # Open coherence if provided
    coh_data = None
    if coherence_raster:
        coh_ds = gdal.Open(coherence_raster)
        if coh_ds:
            coh_data = coh_ds.GetRasterBand(1).ReadAsArray()
    
    for point in points:
        point_id = point.get("id")
        lat = point.get("lat")
        lon = point.get("lon")
        
        if lat is None or lon is None:
            results.append({
                "point_id": point_id,
                "displacement_mm": None,
                "coherence": None,
                "valid": False,
                "error": "Missing coordinates"
            })
            continue
        
        # Convert lat/lon to pixel coordinates
        # pixel_x = (lon - originX) / pixelWidth
        # pixel_y = (lat - originY) / pixelHeight
        px = int((lon - gt[0]) / gt[1])
        py = int((lat - gt[3]) / gt[5])
        
        # Check bounds
        if px < 0 or px >= disp_data.shape[1] or py < 0 or py >= disp_data.shape[0]:
            results.append({
                "point_id": point_id,
                "displacement_mm": None,
                "coherence": None,
                "valid": False,
                "error": "Point outside raster bounds"
            })
            continue
        
        # Extract values
        disp_value = float(disp_data[py, px])
        coh_value = float(coh_data[py, px]) if coh_data is not None else None
        
        # Check for nodata
        valid = (disp_value != disp_nodata) and not np.isnan(disp_value)
        
        results.append({
            "point_id": point_id,
            "displacement_mm": disp_value if valid else None,
            "coherence": coh_value,
            "valid": valid,
            "lat": lat,
            "lon": lon
        })
    
    disp_ds = None
    
    valid_count = len([r for r in results if r["valid"]])
    logger.info(f"Extracted {valid_count}/{len(points)} valid point measurements")
    
    return results


def calculate_velocity(
    displacements: List[Dict[str, Any]],
    time_span_days: float
) -> Dict[str, float]:
    """
    Calculate velocity from displacement measurements.
    
    Args:
        displacements: List of displacement measurements with timestamps
        time_span_days: Time span between measurements
        
    Returns:
        Dict with velocity statistics
    """
    valid_displacements = [
        d["displacement_mm"]
        for d in displacements
        if d.get("valid") and d.get("displacement_mm") is not None
    ]
    
    if not valid_displacements:
        return {
            "mean_velocity_mm_year": None,
            "std_velocity_mm_year": None
        }
    
    # Convert to annual velocity
    annual_factor = 365.25 / time_span_days
    
    velocities = [d * annual_factor for d in valid_displacements]
    
    return {
        "mean_velocity_mm_year": float(np.mean(velocities)),
        "std_velocity_mm_year": float(np.std(velocities)),
        "min_velocity_mm_year": float(np.min(velocities)),
        "max_velocity_mm_year": float(np.max(velocities))
    }


def validate_safe_package(safe_path: str) -> Dict[str, Any]:
    """
    Validate a Sentinel-1 SAFE package.
    
    Args:
        safe_path: Path to SAFE directory or zip file
        
    Returns:
        Dict with validation results
    """
    safe_path = Path(safe_path)
    
    result = {
        "valid": False,
        "granule_name": None,
        "acquisition_date": None,
        "orbit_number": None,
        "error": None
    }
    
    try:
        # Handle zip files
        if safe_path.suffix.lower() == ".zip":
            import zipfile
            if not zipfile.is_zipfile(safe_path):
                result["error"] = "Invalid zip file"
                return result
            
            with zipfile.ZipFile(safe_path, 'r') as zf:
                # Check for manifest.safe
                manifest_found = any('manifest.safe' in n for n in zf.namelist())
                if not manifest_found:
                    result["error"] = "No manifest.safe found in zip"
                    return result
        else:
            # Check for manifest.safe in directory
            manifest = safe_path / "manifest.safe"
            if not manifest.exists():
                result["error"] = "No manifest.safe found in directory"
                return result
        
        # Parse granule name
        granule_name = safe_path.stem
        result["granule_name"] = granule_name
        
        # Extract metadata from name
        # Format: S1A_IW_SLC__1SDV_20231101T...
        parts = granule_name.split("_")
        if len(parts) >= 5:
            date_str = parts[4][:8]
            try:
                result["acquisition_date"] = datetime.strptime(date_str, "%Y%m%d").isoformat()
            except:
                pass
        
        result["valid"] = True
        
    except Exception as e:
        result["error"] = str(e)
    
    return result
