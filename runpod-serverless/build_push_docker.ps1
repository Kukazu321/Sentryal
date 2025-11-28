# SENTRYAL - RunPod Serverless Build & Deploy (PowerShell)
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
#   .\build_push_docker.ps1 [-Tag "v1.0.0"]
# ============================================================================

param(
    [string]$Tag = "latest",
    [string]$DockerUsername = "sentryal"
)

$ErrorActionPreference = "Stop"

$ImageName = "isce3-serverless"
$FullImage = "${DockerUsername}/${ImageName}:${Tag}"

Write-Host "=============================================="
Write-Host "SENTRYAL Docker Build & Push"
Write-Host "=============================================="
Write-Host "Image: $FullImage"
Write-Host "=============================================="

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Navigate to the runpod-serverless directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check if required files exist
if (-not (Test-Path "Dockerfile")) {
    Write-Host "❌ Dockerfile not found in $ScriptDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "handler.py")) {
    Write-Host "❌ handler.py not found in $ScriptDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Step 1/4: Building Docker image..." -ForegroundColor Cyan
Write-Host ""

# Build for linux/amd64 (required for RunPod)
docker build -t $FullImage -t "${DockerUsername}/${ImageName}:latest" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📤 Step 2/4: Pushing to DockerHub..." -ForegroundColor Cyan
Write-Host ""

docker push $FullImage
docker push "${DockerUsername}/${ImageName}:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed. Run 'docker login' first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Step 3/4: Verifying image..." -ForegroundColor Cyan
Write-Host ""

docker pull $FullImage | Out-Null
Write-Host "✓ Image verified: $FullImage" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================="
Write-Host "✅ BUILD COMPLETE!" -ForegroundColor Green
Write-Host "=============================================="
Write-Host ""
Write-Host "Image pushed: $FullImage" -ForegroundColor Green
Write-Host ""
Write-Host "Step 4/4: Create RunPod Serverless Endpoint" -ForegroundColor Yellow
Write-Host "=============================================="
Write-Host ""
Write-Host "1. Go to: https://www.runpod.io/console/serverless"
Write-Host "2. Click 'New Endpoint'"
Write-Host "3. Configure:"
Write-Host "   - Name: sentryal-isce3"
Write-Host "   - Docker Image: $FullImage"
Write-Host "   - GPU: RTX 4090 (or similar)"
Write-Host "   - Active Workers: 0 (scale to 0 when idle)"
Write-Host "   - Max Workers: 2-3"
Write-Host "   - Idle Timeout: 5 minutes"
Write-Host "4. Copy the Endpoint ID"
Write-Host ""
Write-Host "5. Add to your .env:"
Write-Host "   RUNPOD_API_KEY=<your-api-key>"
Write-Host "   RUNPOD_ENDPOINT_ID=<endpoint-id>"
Write-Host ""
Write-Host "=============================================="
