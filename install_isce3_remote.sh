#!/bin/bash
set -e

# Source conda
source /root/.bashrc
source /workspace/miniforge3/etc/profile.d/conda.sh

echo 'Creating isce3 environment...'
mamba create -n isce3 -c conda-forge isce3=0.25.3 python=3.11 numpy scipy h5py pytest -y

echo 'Activating environment...'
conda activate isce3

echo 'Verifying installation...'
python -c 'import isce3; print(f"ISCE3 version: {isce3.__version__}")'
python -c 'import osgeo.gdal; print(f"GDAL version: {osgeo.gdal.__version__}")'

echo 'Installation complete!'
