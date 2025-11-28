# ============================================================================
# SENTRYAL - Quick Start Production
# ============================================================================
# Lance ce script pour déployer Sentryal en production
# ============================================================================

Write-Host "=============================================="
Write-Host "  SENTRYAL - Production Deployment Wizard"
Write-Host "=============================================="
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Cyan

# Check Docker
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerInstalled) {
    Write-Host "❌ Docker not installed. Please install Docker Desktop." -ForegroundColor Red
    Write-Host "   Download: https://www.docker.com/products/docker-desktop/"
    exit 1
}

Write-Host "✓ Docker installed" -ForegroundColor Green

# Check if Docker is running
try {
    docker info 2>&1 | Out-Null
    Write-Host "✓ Docker running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 1: Build Docker Image"
Write-Host "=============================================="
Write-Host ""

$buildDocker = Read-Host "Build and push Docker image to DockerHub? (y/n)"
if ($buildDocker -eq "y") {
    $dockerUsername = Read-Host "DockerHub username (default: sentryal)"
    if ([string]::IsNullOrEmpty($dockerUsername)) {
        $dockerUsername = "sentryal"
    }
    
    Write-Host "Building image..." -ForegroundColor Cyan
    Set-Location "$PSScriptRoot\runpod-serverless"
    & ".\build_push_docker.ps1" -DockerUsername $dockerUsername
    Set-Location $PSScriptRoot
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 2: Configure RunPod Serverless"
Write-Host "=============================================="
Write-Host ""
Write-Host "Manual steps required:"
Write-Host "1. Go to: https://www.runpod.io/console/serverless"
Write-Host "2. Create new endpoint with:"
Write-Host "   - Name: sentryal-isce3"
Write-Host "   - Image: sentryal/isce3-serverless:latest"
Write-Host "   - GPU: RTX 4090"
Write-Host "   - Active Workers: 0"
Write-Host "   - Max Workers: 2"
Write-Host ""
$runpodEndpoint = Read-Host "Enter your RunPod Endpoint ID (or press Enter to skip)"

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 3: Deploy Backend to Railway"
Write-Host "=============================================="
Write-Host ""
Write-Host "Manual steps:"
Write-Host "1. Go to: https://railway.app"
Write-Host "2. Create new project from GitHub"
Write-Host "3. Add PostgreSQL + Redis plugins"
Write-Host "4. Set environment variables (see .env.example)"
Write-Host ""
Write-Host "Press Enter when Railway is configured..."
Read-Host

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 4: Deploy Frontend to Vercel"
Write-Host "=============================================="
Write-Host ""
Write-Host "Manual steps:"
Write-Host "1. Go to: https://vercel.com"
Write-Host "2. Import frontend folder from GitHub"
Write-Host "3. Set NEXT_PUBLIC_API_URL to your Railway URL"
Write-Host ""
Write-Host "Press Enter when Vercel is configured..."
Read-Host

Write-Host ""
Write-Host "=============================================="
Write-Host "  ✅ DEPLOYMENT COMPLETE!"
Write-Host "=============================================="
Write-Host ""
Write-Host "Your production stack:"
Write-Host "  - Frontend: Vercel (free)" -ForegroundColor Green
Write-Host "  - Backend:  Railway (~\$5/mo)" -ForegroundColor Green
Write-Host "  - GPU:      RunPod Serverless (\$0 idle)" -ForegroundColor Green
Write-Host ""
Write-Host "Total cost when idle: \$0"
Write-Host "Total cost per InSAR job: ~\$0.50"
Write-Host ""
Write-Host "See PRODUCTION_DEPLOYMENT_GUIDE.md for full documentation."
Write-Host "=============================================="
