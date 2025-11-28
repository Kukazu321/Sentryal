#!/bin/bash
# =============================================================================
# SENTRYAL - RunPod Auto-Setup Script
# Lance ce script sur un nouveau pod RunPod pour tout installer automatiquement
# Usage: curl -sSL https://raw.githubusercontent.com/.../runpod_setup.sh | bash
# Ou: bash runpod_setup.sh
# =============================================================================

set -e
echo "🚀 SENTRYAL RunPod Setup - Starting..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# -----------------------------------------------------------------------------
# 1. System Update
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/6] Updating system...${NC}"
apt-get update -qq
apt-get install -y -qq git wget curl build-essential cmake libfftw3-dev libgdal-dev gdal-bin python3-pip > /dev/null 2>&1
echo -e "${GREEN}✓ System updated${NC}"

# -----------------------------------------------------------------------------
# 2. Install Miniforge (conda)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/6] Installing Miniforge...${NC}"
if [ ! -d "/workspace/miniforge3" ]; then
    cd /workspace
    wget -q https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
    bash Miniforge3-Linux-x86_64.sh -b -p /workspace/miniforge3
    rm Miniforge3-Linux-x86_64.sh
fi
source /workspace/miniforge3/etc/profile.d/conda.sh
echo -e "${GREEN}✓ Miniforge installed${NC}"

# -----------------------------------------------------------------------------
# 3. Create ISCE3 Environment
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/6] Creating ISCE3 environment...${NC}"
if ! conda env list | grep -q "isce3"; then
    conda create -n isce3 -c conda-forge python=3.11 isce3 numpy scipy gdal rasterio shapely -y -q
fi
conda activate isce3
echo -e "${GREEN}✓ ISCE3 environment ready${NC}"

# -----------------------------------------------------------------------------
# 4. Verify ISCE3 Installation
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/6] Verifying ISCE3...${NC}"
ISCE3_VERSION=$(python -c "import isce3; print(isce3.__version__)" 2>/dev/null || echo "FAILED")
if [ "$ISCE3_VERSION" == "FAILED" ]; then
    echo -e "${RED}✗ ISCE3 installation failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ISCE3 v${ISCE3_VERSION} installed${NC}"

# -----------------------------------------------------------------------------
# 5. Setup Working Directories
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/6] Setting up directories...${NC}"
mkdir -p /workspace/isce_processing
mkdir -p /workspace/data/dem
mkdir -p /workspace/data/orbits
mkdir -p /workspace/data/slc
mkdir -p /workspace/results
echo -e "${GREEN}✓ Directories created${NC}"

# -----------------------------------------------------------------------------
# 6. Create activation script
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/6] Creating activation script...${NC}"
cat > /workspace/activate_isce3.sh << 'EOF'
#!/bin/bash
source /workspace/miniforge3/etc/profile.d/conda.sh
conda activate isce3
echo "ISCE3 environment activated!"
echo "Python: $(which python)"
echo "ISCE3 version: $(python -c 'import isce3; print(isce3.__version__)')"
EOF
chmod +x /workspace/activate_isce3.sh

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ SENTRYAL RunPod Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "ISCE3 Version: $ISCE3_VERSION"
echo ""
echo "To activate ISCE3 environment:"
echo "  source /workspace/activate_isce3.sh"
echo ""
echo "Working directories:"
echo "  /workspace/isce_processing - Processing workspace"
echo "  /workspace/data/           - Input data (DEM, orbits, SLC)"
echo "  /workspace/results/        - Output results"
echo ""
echo -e "${YELLOW}Ready to connect your backend!${NC}"
