#!/bin/bash

##############################################################################
# GMTSAR Integration Script for Sentryal
# 
# Automates GMTSAR processing pipeline for Sentinel-1 InSAR
# 
# Usage:
#   ./run_gmtsar.sh <job_id> <reference_granule> <secondary_granule> <dem_path> [bbox_json]
#
# Example:
#   ./run_gmtsar.sh job123 S1A_IW_SLC__1SDV_20190704T135158_*.SAFE S1A_IW_SLC__1SDV_20190716T135159_*.SAFE /path/to/dem.grd
#
##############################################################################

set -e  # Exit on error

# Configuration
GMTSAR_HOME="${GMTSAR_HOME:-/usr/local/GMTSAR}"
WORK_DIR="${WORK_DIR:-/tmp/gmtsar_processing}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# Function: Print log message
log() {
    local level=$1
    shift
    local msg="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${msg}"
}

# Function: Print error and exit
error_exit() {
    log "ERROR" "$@"
    exit 1
}

# Function: Check if GMTSAR is installed
check_gmtsar_installation() {
    log "INFO" "Checking GMTSAR installation..."
    
    if [ ! -d "$GMTSAR_HOME" ]; then
        error_exit "GMTSAR_HOME not found: $GMTSAR_HOME"
    fi
    
    # Check for essential GMTSAR scripts
    local essential_scripts=("p2p_S1_TOPS_Frame.csh" "make_s1a_tops" "align_tops.csh" "dem2topo_ra.csh" "intf_tops.csh" "filter.csh" "snaphu.csh" "geocode.csh" "proj_ra2ll.csh")
    
    for script in "${essential_scripts[@]}"; do
        if [ ! -f "$GMTSAR_HOME/bin/$script" ] && [ ! -f "$GMTSAR_HOME/$script" ]; then
            log "WARN" "GMTSAR script not found: $script (may not be in PATH)"
        fi
    done
    
    log "INFO" "GMTSAR installation verified"
}

# Function: Check dependencies
check_dependencies() {
    log "INFO" "Checking dependencies..."
    
    local deps=("gmt" "gawk" "csh")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error_exit "Dependency not found: $dep"
        fi
    done
    
    log "INFO" "All dependencies available"
}

# Function: Setup directory structure
setup_directories() {
    local job_id=$1
    local working_dir="$WORK_DIR/$job_id"
    
    log "INFO" "Setting up directory structure at $working_dir"
    
    mkdir -p "$working_dir"/{raw,SLC,topo,intf,logs}
    
    log "INFO" "Directory structure created"
    echo "$working_dir"
}

# Function: Verify SAR data
verify_sar_data() {
    local raw_dir=$1
    local ref_granule=$2
    local sec_granule=$3
    
    log "INFO" "Verifying SAR data..."
    
    if [ ! -d "$raw_dir/$ref_granule" ]; then
        error_exit "Reference granule not found: $raw_dir/$ref_granule"
    fi
    
    if [ ! -d "$raw_dir/$sec_granule" ]; then
        error_exit "Secondary granule not found: $raw_dir/$sec_granule"
    fi
    
    log "INFO" "SAR data verified"
}

# Function: Verify DEM
verify_dem() {
    local dem_path=$1
    
    log "INFO" "Verifying DEM file..."
    
    if [ ! -f "$dem_path" ]; then
        error_exit "DEM file not found: $dem_path"
    fi
    
    local dem_size=$(stat -f%z "$dem_path" 2>/dev/null || stat -c%s "$dem_path")
    
    if [ "$dem_size" -lt 1000 ]; then
        error_exit "DEM file too small (corrupted?): $dem_path"
    fi
    
    log "INFO" "DEM file verified (size: $dem_size bytes)"
}

# Function: Stage 1 - Preprocessing
stage1_preprocessing() {
    local job_id=$1
    local working_dir=$2
    local ref_granule=$3
    local sec_granule=$4
    
    log "INFO" "Starting Stage 1: Preprocessing"
    
    local raw_dir="$working_dir/raw"
    local slc_dir="$working_dir/SLC"
    local log_file="$working_dir/logs/stage1_preprocessing.log"
    
    # Run make_s1a_tops for reference
    log "INFO" "Processing reference image: $ref_granule"
    cd "$working_dir"
    $GMTSAR_HOME/bin/make_s1a_tops $ref_granule $raw_dir $slc_dir >> "$log_file" 2>&1 || error_exit "Reference image preprocessing failed"
    
    # Run make_s1a_tops for secondary
    log "INFO" "Processing secondary image: $sec_granule"
    $GMTSAR_HOME/bin/make_s1a_tops $sec_granule $raw_dir $slc_dir >> "$log_file" 2>&1 || error_exit "Secondary image preprocessing failed"
    
    log "INFO" "Stage 1 completed successfully"
}

# Function: Stage 2 - Alignment
stage2_alignment() {
    local job_id=$1
    local working_dir=$2
    
    log "INFO" "Starting Stage 2: Alignment"
    
    local slc_dir="$working_dir/SLC"
    local log_file="$working_dir/logs/stage2_alignment.log"
    local config_file="$working_dir/config.tops.txt"
    
    cd "$working_dir"
    
    # Create default config if not exists
    if [ ! -f "$config_file" ]; then
        log "INFO" "Creating default GMTSAR config"
        cat > "$config_file" << 'EOF'
# GMTSAR configuration for Sentinel-1 TOPS
num_patches = 1
skip_init = 0
memory_ratio = 0.75
filter_wavelength = 200
dec_factor = 1
range_dec = 2
azimuth_dec = 1
threshold_snaphu = 0.1
defomax = 0
region_cut = 20
switch_land = 1
detrend = 0
range_filtering = 1
azimuth_filtering = 1
geocode = 1
proc_stage = 5
EOF
    fi
    
    log "INFO" "Running alignment with align_tops.csh"
    $GMTSAR_HOME/bin/align_tops.csh $slc_dir $config_file >> "$log_file" 2>&1 || error_exit "Alignment failed"
    
    log "INFO" "Stage 2 completed successfully"
}

# Function: Stage 3 - Back geocoding
stage3_geocoding() {
    local job_id=$1
    local working_dir=$2
    local dem_path=$3
    
    log "INFO" "Starting Stage 3: Back Geocoding"
    
    local slc_dir="$working_dir/SLC"
    local topo_dir="$working_dir/topo"
    local log_file="$working_dir/logs/stage3_geocoding.log"
    
    cd "$working_dir"
    
    # Copy DEM to topo directory
    log "INFO" "Copying DEM to topo directory"
    cp "$dem_path" "$topo_dir/dem.grd"
    
    # Create topo_ra.grd
    log "INFO" "Creating topography in radar coordinates"
    $GMTSAR_HOME/bin/dem2topo_ra.csh $slc_dir/master.PRM $topo_dir/dem.grd $topo_dir/topo_ra.grd >> "$log_file" 2>&1 || error_exit "dem2topo_ra.csh failed"
    
    log "INFO" "Stage 3 completed successfully"
}

# Function: Stage 4 - Interferometry
stage4_interferometry() {
    local job_id=$1
    local working_dir=$2
    
    log "INFO" "Starting Stage 4: Interferometry"
    
    local slc_dir="$working_dir/SLC"
    local topo_dir="$working_dir/topo"
    local intf_dir="$working_dir/intf"
    local log_file="$working_dir/logs/stage4_interferometry.log"
    
    cd "$working_dir"
    
    # Create interferogram
    log "INFO" "Creating interferogram with intf_tops.csh"
    $GMTSAR_HOME/bin/intf_tops.csh $slc_dir $intf_dir $topo_dir >> "$log_file" 2>&1 || error_exit "intf_tops.csh failed"
    
    # Filter interferogram
    log "INFO" "Filtering interferogram"
    $GMTSAR_HOME/bin/filter.csh $intf_dir/phasefilt.grd 2 $intf_dir/phasefilt_filtered.grd >> "$log_file" 2>&1 || error_exit "filter.csh failed"
    
    log "INFO" "Stage 4 completed successfully"
}

# Function: Stage 5 - Unwrapping (optional)
stage5_unwrapping() {
    local job_id=$1
    local working_dir=$2
    
    log "INFO" "Starting Stage 5: Phase Unwrapping"
    
    local intf_dir="$working_dir/intf"
    local log_file="$working_dir/logs/stage5_unwrapping.log"
    
    cd "$working_dir"
    
    # Check if coherence exists
    if [ ! -f "$intf_dir/corr.grd" ]; then
        log "WARN" "Coherence file not found, skipping unwrapping"
        return
    fi
    
    # Create mask for coherence threshold
    log "INFO" "Creating coherence mask"
    gmt grdmath $intf_dir/corr.grd 0.1 GE 0 NAN = $intf_dir/mask_def.grd >> "$log_file" 2>&1
    
    # Run snaphu
    log "INFO" "Unwrapping with SNAPHU"
    $GMTSAR_HOME/bin/snaphu.csh $intf_dir/phasefilt_filtered.grd $intf_dir/mask_def.grd >> "$log_file" 2>&1 || log "WARN" "SNAPHU unwrapping failed (non-critical)"
    
    log "INFO" "Stage 5 completed"
}

# Function: Stage 6 - Geocoding to lat/lon
stage6_geocoding_latlon() {
    local job_id=$1
    local working_dir=$2
    
    log "INFO" "Starting Stage 6: Geocoding to Lat/Lon"
    
    local slc_dir="$working_dir/SLC"
    local intf_dir="$working_dir/intf"
    local log_file="$working_dir/logs/stage6_geocoding_latlon.log"
    
    cd "$working_dir"
    
    # Check trans.dat exists
    if [ ! -f "$slc_dir/trans.dat" ]; then
        error_exit "trans.dat not found - geocoding cannot proceed"
    fi
    
    # Try unwrapped first
    local input_file="$intf_dir/unwrap.grd"
    local output_file="$intf_dir/unwrap_ll.grd"
    
    if [ ! -f "$input_file" ]; then
        input_file="$intf_dir/phasefilt.grd"
        output_file="$intf_dir/phasefilt_ll.grd"
    fi
    
    log "INFO" "Projecting to lat/lon coordinates"
    $GMTSAR_HOME/bin/proj_ra2ll.csh $slc_dir/trans.dat $input_file $output_file >> "$log_file" 2>&1 || error_exit "proj_ra2ll.csh failed"
    
    # Also geocode coherence
    if [ -f "$intf_dir/corr.grd" ]; then
        log "INFO" "Geocoding coherence"
        $GMTSAR_HOME/bin/proj_ra2ll.csh $slc_dir/trans.dat $intf_dir/corr.grd $intf_dir/corr_ll.grd >> "$log_file" 2>&1
    fi
    
    log "INFO" "Stage 6 completed successfully"
}

# Function: Convert phase to displacement in mm
convert_phase_to_displacement() {
    local job_id=$1
    local working_dir=$2
    
    log "INFO" "Converting phase to displacement in mm"
    
    local intf_dir="$working_dir/intf"
    local wavelength="0.0554658"  # Sentinel-1 wavelength in meters
    
    cd "$intf_dir"
    
    # Try unwrapped first
    local input_file="unwrap_ll.grd"
    local output_file="displacement_ll_mm.grd"
    
    if [ ! -f "$input_file" ]; then
        input_file="phasefilt_ll.grd"
        output_file="phase_ll_mm.grd"
    fi
    
    # Convert: phase (rad) * wavelength (m) * -79.58 = LOS displacement (mm)
    log "INFO" "Running GMT math conversion"
    gmt grdmath $input_file $wavelength MUL -79.58 MUL = $output_file
    
    log "INFO" "Displacement file created: $output_file"
}

# Main execution
main() {
    if [ $# -lt 4 ]; then
        error_exit "Usage: $0 <job_id> <reference_granule> <secondary_granule> <dem_path> [bbox_json]"
    fi
    
    local job_id=$1
    local ref_granule=$2
    local sec_granule=$3
    local dem_path=$4
    
    local start_time=$(date +%s)
    
    log "INFO" "=========================================="
    log "INFO" "GMTSAR InSAR Processing Pipeline"
    log "INFO" "Job ID: $job_id"
    log "INFO" "Reference: $ref_granule"
    log "INFO" "Secondary: $sec_granule"
    log "INFO" "DEM: $dem_path"
    log "INFO" "=========================================="
    
    # Checks
    check_gmtsar_installation
    check_dependencies
    
    # Setup
    local working_dir=$(setup_directories "$job_id")
    
    # Prepare data
    verify_sar_data "$working_dir/raw" "$ref_granule" "$sec_granule"
    verify_dem "$dem_path"
    
    # Run pipeline
    stage1_preprocessing "$job_id" "$working_dir" "$ref_granule" "$sec_granule"
    stage2_alignment "$job_id" "$working_dir"
    stage3_geocoding "$job_id" "$working_dir" "$dem_path"
    stage4_interferometry "$job_id" "$working_dir"
    stage5_unwrapping "$job_id" "$working_dir"
    stage6_geocoding_latlon "$job_id" "$working_dir"
    convert_phase_to_displacement "$job_id" "$working_dir"
    
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))
    
    log "INFO" "=========================================="
    log "INFO" "Processing completed successfully!"
    log "INFO" "Elapsed time: ${elapsed} seconds"
    log "INFO" "Working directory: $working_dir"
    log "INFO" "=========================================="
    
    echo "$working_dir/intf/displacement_ll_mm.grd"
}

# Run main function
main "$@"
