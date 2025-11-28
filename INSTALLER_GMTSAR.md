# GMTSAR Installation Guide

## Quick Install (Recommended)

### Step 1: Build and Start Docker Containers

```powershell
# Navigate to project root
cd c:\Users\charl\Downloads\Sentryal

# Build GMTSAR image (first time - takes 10-15 minutes)
docker-compose build gmtsar

# Start all services
docker-compose up -d

# Verify everything is running
docker-compose ps
```

### Step 2: Verify GMTSAR Installation

```bash
# Check GMTSAR container health
docker-compose exec gmtsar verify-gmtsar.sh

# You should see:
# ✓ GMT: 6.4.0
# ✓ GMTSAR: /opt/gmtsar
# ✓ SNAPHU: OK
# ✓ GMTSAR scripts ready
```

### Step 3: Check Backend Connectivity

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Should include gmtsar status
```

---

## Build Command

```powershell
# Build GMTSAR image only (12-15 GB downloads, 30 min build time)
docker build -t sentryal-gmtsar:latest -f backend/Dockerfile.gmtsar backend/

# Or with docker-compose
docker-compose build --no-cache gmtsar
```

---

## Post-Installation Setup

### Step 1: Prepare Data Directories

```bash
# Create shared data directories
mkdir -p ./data/gmtsar/processing
mkdir -p ./data/gmtsar/dem_cache
mkdir -p ./data/gmtsar/orbit_cache

# Set permissions
chmod -R 777 ./data/gmtsar
```

### Step 2: Download Sample Data (Optional)

```bash
# Download a sample Sentinel-1 pair from ASF (for testing)
# https://search.asf.alaska.edu/

# Place in ./data/gmtsar/processing/
```

### Step 3: Generate Test DEM

```bash
# Generate a sample DEM for testing (California area)
docker-compose exec gmtsar generate-dem.sh -120 -119 37 38 /data/dem_test.grd
```

---

## What Gets Installed

| Component | Version | Location |
|-----------|---------|----------|
| GMT | 6.4.0 | `/opt/GMT` |
| GMTSAR | Latest | `/opt/gmtsar` |
| SNAPHU | Latest | `/opt/snaphu` |
| Python | 3.10 | System |
| GDAL | Latest | System |

---

## Verification Checklist

After installation, verify everything works:

```bash
# 1. Check GMT
docker-compose exec gmtsar gmt --version

# 2. Check GMTSAR scripts
docker-compose exec gmtsar ls -l ${GMTSAR_ROOT}/bin/p2p_S1_TOPS_Frame.csh

# 3. Check SNAPHU
docker-compose exec gmtsar snaphu -v

# 4. Check shared volumes
docker-compose exec gmtsar ls -la /data/

# 5. Test health endpoint
curl http://localhost:5000/api/health | jq '.services.gmtsar'
```

---

## Troubleshooting

### GMTSAR container fails to start

```powershell
# Check logs
docker-compose logs gmtsar

# Rebuild from scratch
docker-compose down
docker system prune -a
docker-compose build --no-cache gmtsar
docker-compose up -d
```

### "GMTSAR not properly installed or not found in PATH"

```bash
# Check if PATH is set correctly in container
docker-compose exec gmtsar echo $PATH

# Manually verify installation
docker-compose exec gmtsar bash -c "test -f ${GMTSAR_ROOT}/bin/p2p_S1_TOPS_Frame.csh && echo OK"
```

### Build hangs during GMT compilation

This is normal - GMT is large. Wait 15-20 minutes. If it times out:

```powershell
# Increase Docker timeout
# Settings → Resources → Disk image size: 60GB+

# Or rebuild with more resources
docker build --build-arg BUILDKIT_INLINE_CACHE=1 -f backend/Dockerfile.gmtsar backend/
```

---

## Performance Tuning

### Allocate more resources to GMTSAR

Edit `docker-compose.yml`:

```yaml
gmtsar:
  deploy:
    resources:
      limits:
        cpus: '8'
        memory: 16G
```

### Speed up builds

Use BuildKit:

```powershell
$env:DOCKER_BUILDKIT=1
docker-compose build gmtsar
```

---

## Next Steps

1. ✅ GMTSAR is installed and running
2. Now update backend to use GMTSAR service (see `insarWorker.ts` changes)
3. Test with sample Sentinel-1 data
4. Monitor processing via `/api/jobs/{jobId}`

---

## Useful Commands

```bash
# Interactive shell in GMTSAR container
docker-compose exec gmtsar bash

# View GMTSAR version info
docker-compose exec gmtsar cat ${GMTSAR_ROOT}/include/gmtsar.h

# Download sample orbit file
docker-compose exec gmtsar download-sentinel-orbits.sh 20230101

# Generate DEM
docker-compose exec gmtsar generate-dem.sh -120 -119 37 38 dem.grd

# View container resource usage
docker stats sentryal-gmtsar
```

---

## Rebuild Strategy

If you need to rebuild GMTSAR (e.g., after code changes):

```powershell
# Option 1: Quick rebuild (uses cache)
docker-compose build gmtsar

# Option 2: Clean rebuild (takes 30 minutes)
docker-compose build --no-cache gmtsar

# Option 3: Rebuild just the runtime image
docker-compose build --build-arg BUILDKIT_INLINE_CACHE=0 gmtsar
```

---

**Status**: ✅ Installation complete
**Next**: See backend `insarWorker.ts` for integration
