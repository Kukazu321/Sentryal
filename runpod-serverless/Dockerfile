# ============================================================================
# SENTRYAL - RunPod Serverless Docker Image
# ISCE3 InSAR Processing Environment
# ============================================================================
# Build: docker build -t sentryal/isce3-serverless:latest .
# Push:  docker push sentryal/isce3-serverless:latest
# ============================================================================

FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

LABEL maintainer="Sentryal Team"
LABEL description="ISCE3 InSAR Processing for RunPod Serverless"
LABEL version="1.0.0"

# ============================================================================
# Environment Variables
# ============================================================================
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CONDA_DIR=/opt/conda
ENV PATH=$CONDA_DIR/bin:$PATH
ENV ISCE3_ENV=isce3

# ============================================================================
# System Dependencies
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    curl \
    wget \
    git \
    ca-certificates \
    bzip2 \
    unzip \
    # Compilation tools
    build-essential \
    cmake \
    gfortran \
    # Image processing
    libgdal-dev \
    gdal-bin \
    # Numeric libs
    libfftw3-dev \
    liblapack-dev \
    libblas-dev \
    # Networking
    libcurl4-openssl-dev \
    # Python dependencies
    libsqlite3-dev \
    libssl-dev \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# Miniforge (Conda) Installation
# ============================================================================
RUN wget -q https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh -O /tmp/miniforge.sh \
    && bash /tmp/miniforge.sh -b -p $CONDA_DIR \
    && rm /tmp/miniforge.sh \
    && conda clean -afy

# ============================================================================
# ISCE3 Environment Setup
# ============================================================================
RUN conda create -n $ISCE3_ENV python=3.10 -y \
    && conda run -n $ISCE3_ENV conda install -c conda-forge -y \
    # ISCE3 and dependencies
    isce3 \
    # Scientific Python
    numpy \
    scipy \
    matplotlib \
    pandas \
    # Geospatial
    gdal \
    rasterio \
    pyproj \
    shapely \
    geopandas \
    # Image processing
    scikit-image \
    # Utilities
    requests \
    boto3 \
    pyyaml \
    # Clean up
    && conda clean -afy

# ============================================================================
# RunPod SDK Installation
# ============================================================================
RUN conda run -n $ISCE3_ENV pip install --no-cache-dir \
    runpod \
    httpx \
    aiofiles

# ============================================================================
# Create working directories
# ============================================================================
RUN mkdir -p /app /workspace /data/input /data/output /data/dem /data/logs

WORKDIR /app

# ============================================================================
# Copy application code
# ============================================================================
COPY handler.py /app/handler.py
COPY isce3_processor.py /app/isce3_processor.py
COPY utils.py /app/utils.py

# ============================================================================
# Environment activation script
# ============================================================================
RUN echo "#!/bin/bash\n\
source $CONDA_DIR/etc/profile.d/conda.sh\n\
conda activate $ISCE3_ENV\n\
exec python -u /app/handler.py" > /app/start.sh \
    && chmod +x /app/start.sh

# ============================================================================
# Health check
# ============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD conda run -n $ISCE3_ENV python -c "import isce3; import runpod; print('OK')" || exit 1

# ============================================================================
# Entry point
# ============================================================================
CMD ["/app/start.sh"]
