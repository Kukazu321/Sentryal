#!/usr/bin/env python3
"""
ASF Download Script using asf_search library
Downloads Sentinel-1 SLC granules with proper Earthdata authentication
Credentials passed via stdin to avoid shell escaping issues
"""

import sys
import os
import json
import asf_search as asf

def download_granule(granule_name, output_dir, username, password):
    """
    Download a single Sentinel-1 granule using asf_search
    
    Args:
        granule_name: Name of the granule to download
        output_dir: Directory to save the downloaded file
        username: Earthdata username
        password: Earthdata password
        
    Returns:
        Path to downloaded file
    """
    try:
        # Create output directory if doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Search for the specific granule
        results = asf.granule_search([granule_name])
        
        if not results:
            raise Exception(f"Granule not found: {granule_name}")
        
        # Create authenticated session
        session = asf.ASFSession().auth_with_creds(username, password)
        
        # Download the granule
        results.download(
            path=output_dir,
            session=session,
            processes=1  # Sequential download
        )
        
        # Return path to downloaded ZIP
        zip_filename = f"{granule_name}.zip"
        zip_path = os.path.join(output_dir, zip_filename)
        
        if os.path.exists(zip_path):
            size_mb = os.path.getsize(zip_path) / (1024 * 1024)
            print(f"SUCCESS: Downloaded {zip_filename} ({size_mb:.2f} MB)")
            return zip_path
        else:
            raise Exception(f"Download completed but file not found: {zip_path}")
            
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Read credentials from stdin as JSON to avoid shell escaping issues
    raw_input = sys.stdin.read()
    try:
        input_data = json.loads(raw_input)
        granule_name = input_data['granule']
        output_dir = input_data['output_dir']
        username = input_data['username']
        password = input_data['password']
    except (json.JSONDecodeError, KeyError) as e:
        print(f"ERROR: Invalid input JSON: {e}", file=sys.stderr)
        print(f"Received input (repr): {repr(raw_input)}", file=sys.stderr)
        print("Expected: {\"granule\": \"...\", \"output_dir\": \"...\", \"username\": \"...\", \"password\": \"...\"}", file=sys.stderr)
        sys.exit(1)
    
    download_granule(granule_name, output_dir, username, password)
