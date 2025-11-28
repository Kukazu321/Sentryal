#!/bin/bash
# ============================================================================
# SENTRYAL - Docker Build & Push Script
# ============================================================================
# Ce script construit et pousse l'image Docker ISCE3 vers DockerHub
# pour utilisation avec RunPod Serverless.
#
# Prérequis:
#   - Docker Desktop installé et lancé
#   - Compte DockerHub créé
#   - docker login effectué
#
# Usage:
#   ./build_push_docker.sh [tag]
#   
# Exemple:
#   ./build_push_docker.sh latest
#   ./build_push_docker.sh v1.0.0
# ============================================================================

set -e

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-sentryal}"
IMAGE_NAME="isce3-serverless"
TAG="${1:-latest}"
FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"

echo "=============================================="
echo "SENTRYAL Docker Build & Push"
echo "=============================================="
echo "Image: ${FULL_IMAGE}"
echo "=============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Navigate to the runpod-serverless directory
cd "$(dirname "$0")"

# Check if required files exist
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found in $(pwd)"
    exit 1
fi

if [ ! -f "handler.py" ]; then
    echo "❌ handler.py not found in $(pwd)"
    exit 1
fi

echo ""
echo "📦 Step 1/4: Building Docker image..."
echo ""

# Build for linux/amd64 (required for RunPod)
docker buildx build \
    --platform linux/amd64 \
    -t "${FULL_IMAGE}" \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:latest" \
    --push \
    . \
    || {
        # Fallback if buildx is not available
        echo "buildx not available, using standard build..."
        docker build -t "${FULL_IMAGE}" .
        docker tag "${FULL_IMAGE}" "${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
    }

echo ""
echo "📤 Step 2/4: Pushing to DockerHub..."
echo ""

# Push if not already pushed by buildx
if ! docker buildx inspect > /dev/null 2>&1; then
    docker push "${FULL_IMAGE}"
    docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
fi

echo ""
echo "✅ Step 3/4: Verifying image..."
echo ""

# Verify the image exists on DockerHub
docker pull "${FULL_IMAGE}" > /dev/null 2>&1 && {
    echo "✓ Image verified: ${FULL_IMAGE}"
}

echo ""
echo "=============================================="
echo "✅ BUILD COMPLETE!"
echo "=============================================="
echo ""
echo "Image pushed: ${FULL_IMAGE}"
echo ""
echo "Step 4/4: Create RunPod Serverless Endpoint"
echo "=============================================="
echo ""
echo "1. Go to: https://www.runpod.io/console/serverless"
echo "2. Click 'New Endpoint'"
echo "3. Configure:"
echo "   - Name: sentryal-isce3"
echo "   - Docker Image: ${FULL_IMAGE}"
echo "   - GPU: RTX 4090 (or similar)"
echo "   - Active Workers: 0 (scale to 0 when idle)"
echo "   - Max Workers: 2-3"
echo "   - Idle Timeout: 5 minutes"
echo "4. Copy the Endpoint ID"
echo ""
echo "5. Add to your .env:"
echo "   RUNPOD_API_KEY=<your-api-key>"
echo "   RUNPOD_ENDPOINT_ID=<endpoint-id>"
echo ""
echo "=============================================="
