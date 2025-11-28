#!/bin/bash
set -e

# Force root home if HOME is not set
export HOME=/root
export INSTALL_DIR="$HOME/miniforge3"

echo "Target directory: $INSTALL_DIR"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Installing Miniforge..."
    wget -q https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh -O Miniforge3.sh
    bash Miniforge3.sh -b -p "$INSTALL_DIR"
    rm Miniforge3.sh
else
    echo "Miniforge directory exists."
fi

source "$INSTALL_DIR/etc/profile.d/conda.sh"

echo "Creating isce3 environment..."
# Try using mamba from the bin directory explicitly
if [ -f "$INSTALL_DIR/bin/mamba" ]; then
    "$INSTALL_DIR/bin/mamba" create -n isce3 -c conda-forge isce3 -y
else
    echo "Mamba not found, trying conda..."
    conda create -n isce3 -c conda-forge isce3 -y
fi

echo "ISCE3 installation complete."
