# GMTSAR Integration - Deployment & Installation Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (recommended for GMTSAR)
- 50GB+ free disk space (for processing jobs)

---

## 📦 Installation Methods

### Option 1: Docker (Recommended)

#### Build GMTSAR Docker image
```bash
cd backend
docker build -f Dockerfile.gmtsar -t sentryal-gmtsar:latest .
```

#### Update docker-compose.yml
```yaml
version: '3.8'

services:
  # ... existing services ...

  gmtsar:
    build:
      context: ./backend
      dockerfile: Dockerfile.gmtsar
    image: sentryal-gmtsar:latest
    container_name: sentryal-gmtsar
    volumes:
      - gmtsar_data:/data/gmtsar
      - ./backend:/app
    environment:
      GMTSAR_HOME: /usr/local/GMTSAR
      GMTSAR_WORK_DIR: /data/gmtsar/processing
      DEM_CACHE_DIR: /data/gmtsar/dem_cache
      ORBIT_CACHE_DIR: /data/gmtsar/orbit_cache
    networks:
      - sentryal-network
    healthcheck:
      test: ["CMD", "test", "-f", "/usr/local/GMTSAR/bin/p2p_S1_TOPS_Frame.csh"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    environment:
      GMTSAR_HOME: /usr/local/GMTSAR
      GMTSAR_WORK_DIR: /data/gmtsar/processing
      DEM_CACHE_DIR: /data/gmtsar/dem_cache
    depends_on:
      - gmtsar

volumes:
  gmtsar_data:

networks:
  sentryal-network:
```

#### Run with Docker Compose
```bash
docker-compose up -d gmtsar backend
docker-compose logs -f backend
```

---

### Option 2: Native Installation (Ubuntu/Debian)

#### 1. Install GMTSAR dependencies
```bash
# Update package list
sudo apt-get update

# Install build tools
sudo apt-get install -y \
    build-essential \
    git \
    autoconf \
    automake \
    libtool \
    pkg-config \
    cmake

# Install GMTSAR dependencies
sudo apt-get install -y \
    libgdal-dev \
    libnetcdf-dev \
    libhdf5-dev \
    libblas-dev \
    liblapack-dev \
    libfftw3-dev

# Install GMT (GMTSAR uses GMT for grid operations)
sudo apt-get install -y \
    gmt \
    gmt-dcw \
    gmt-gshhg \
    libgmt-dev

# Install utilities
sudo apt-get install -y \
    csh \
    gawk \
    python3 \
    python3-pip
```

#### 2. Clone and compile GMTSAR
```bash
# Create installation directory
sudo mkdir -p /usr/local/GMTSAR

# Clone GMTSAR repository
cd /tmp
git clone https://github.com/gmtsar/gmtsar.git
cd gmtsar

# Configure with orbit files directory
autoconf
./configure \
    --with-orbits-dir=/data/gmtsar_orbits \
    --prefix=/usr/local/GMTSAR

# Compile and install
make
sudo make install

# Verify installation
which p2p_S1_TOPS_Frame.csh
```

#### 3. Download orbit files (optional but recommended)
```bash
# Create orbit directory
mkdir -p /data/gmtsar_orbits
cd /data/gmtsar_orbits

# Download ORBITS.tar from GMTSAR website
wget https://topex.ucsd.edu/gmtsar/tar/ORBITS.tar
tar -xvf ORBITS.tar
```

#### 4. Set environment variables
```bash
# Add to ~/.bashrc or ~/.zshrc
export GMTSAR_HOME=/usr/local/GMTSAR
export GMTSAR_WORK_DIR=/tmp/gmtsar_processing
export PATH=$GMTSAR_HOME/bin:$PATH
export GMT_LIBRARY_PATH=/usr/local/gmt/lib

# Reload shell configuration
source ~/.bashrc
```

---

### Option 3: macOS (Homebrew)

```bash
# Install GMTSAR via Homebrew
brew install gmtsar

# Verify installation
which p2p_S1_TOPS_Frame.csh

# Set environment variables
export GMTSAR_HOME=$(brew --prefix gmtsar)
export PATH=$GMTSAR_HOME/bin:$PATH
```

---

## ⚙️ Configuration

### 1. Environment Variables

Create or update `backend/.env`:
```bash
# GMTSAR Configuration
GMTSAR_HOME=/usr/local/GMTSAR
GMTSAR_WORK_DIR=/tmp/gmtsar_processing
DEM_CACHE_DIR=/tmp/gmtsar_dem_cache
ORBIT_CACHE_DIR=/tmp/gmtsar_orbit_cache

# Processing
MAX_PARALLEL_JOBS=5
GMTSAR_JOB_TIMEOUT=3600

# Unwrapping
SNAPHU_COHERENCE_THRESHOLD=0.1
ENABLE_UNWRAPPING=true

# Output
KEEP_INTERMEDIATE_FILES=false
COMPRESS_OUTPUTS=true

# Logging
LOG_LEVEL=INFO
```

### 2. Create working directories
```bash
# Create processing directories with proper permissions
mkdir -p /tmp/gmtsar_processing
mkdir -p /tmp/gmtsar_dem_cache
mkdir -p /tmp/gmtsar_orbit_cache
mkdir -p /tmp/gmtsar_logs

chmod 777 /tmp/gmtsar_*
```

### 3. Configure Node.js backend

The backend automatically:
- Imports `gmtsarService` from `services/gmtsarService.ts`
- Verifies GMTSAR installation on startup
- Initializes Redis queue for job processing
- Monitors GMTSAR health via health check endpoint

---

## 🔄 Processing Pipeline

### Data Flow

1. **Frontend** sends job request with bbox and infrastructure ID
2. **Backend** validates and creates job record in database
3. **GranuleSearchService** searches for Sentinel-1 pairs via ASF API
4. **Job enqueued** to Redis BullMQ queue
5. **Worker** (insarWorker.ts) processes:
   - Downloads SAR granules & orbit files
   - Generates or validates DEM
   - Runs GMTSAR pipeline (6 stages)
   - Extracts displacement at infrastructure points
   - Stores results in database
   - Calculates velocities
6. **Frontend** polls status and displays results

### Processing Stages (GMTSAR)

| Stage | Script | Purpose | Time |
|-------|--------|---------|------|
| 1 | make_s1a_tops | Preprocess raw SAR data to SLC | 1-2 min |
| 2 | align_tops.csh | Align secondary to reference | 2-3 min |
| 3 | dem2topo_ra.csh | Create topography in radar coords | 1 min |
| 4 | intf_tops.csh | Generate interferogram | 3-5 min |
|   | filter.csh | Filter interferogram | 1-2 min |
| 5 | snaphu.csh | Unwrap phase (optional) | 5-10 min |
| 6 | proj_ra2ll.csh | Geocode to lat/lon | 2-3 min |
|   | gmt grdmath | Convert to displacement (mm) | <1 min |

**Total processing time: ~20-30 minutes per interferogram pair**

---

## 🧪 Testing

### 1. Verify GMTSAR Installation
```bash
# Run health check
curl http://localhost:3000/api/health

# Expected output:
# {
#   "ok": true,
#   "services": {
#     "database": true,
#     "redis": true,
#     "gmtsar": { "ok": true }
#   }
# }
```

### 2. Test with Sample Data
```bash
# Use GMTSAR sample datasets
# https://topex.ucsd.edu/gmtsar/downloads/

# Download Sentinel-1 example
wget https://topex.ucsd.edu/gmtsar/tar/S1A_example.tar.bz2
tar -xjf S1A_example.tar.bz2

# Follow README in extracted directory
cd S1A_example
./README.txt >& logfile.txt &
```

### 3. Manual Job Processing
```bash
# Create test job via API
curl -X POST http://localhost:3000/api/jobs/process-insar \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "infrastructureId": "infra-123",
    "referenceGranule": "S1A_IW_SLC__1SDV_20190704T135158_...",
    "secondaryGranule": "S1A_IW_SLC__1SDV_20190716T135159_...",
    "bbox": {
      "north": 38.0,
      "south": 37.0,
      "east": -119.0,
      "west": -120.0
    }
  }'

# Monitor progress
curl http://localhost:3000/api/jobs/{jobId} \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## 📊 Monitoring

### 1. Check Processing Logs
```bash
# View GMTSAR processing logs
tail -f /tmp/gmtsar_logs/*.log

# View backend logs
docker-compose logs -f backend

# View Redis queue status
redis-cli KEYS "bull:insar-processing:*"
redis-cli HGETALL "bull:insar-processing:job-{jobId}"
```

### 2. Monitor System Resources
```bash
# CPU and memory usage
top

# Disk usage
du -sh /tmp/gmtsar_processing
du -sh /tmp/gmtsar_dem_cache

# I/O operations
iostat -x 1
```

### 3. Health Metrics
```bash
# Metrics endpoint
curl http://localhost:3000/api/metrics | grep gmtsar

# Redis queue statistics
redis-cli INFO stats
```

---

## 🚨 Troubleshooting

### GMTSAR Not Found
```bash
# Check PATH
echo $GMTSAR_HOME
echo $PATH

# Verify installation
ls -la $GMTSAR_HOME/bin/p2p_S1_TOPS_Frame.csh

# Add to PATH if missing
export GMTSAR_HOME=/usr/local/GMTSAR
export PATH=$GMTSAR_HOME/bin:$PATH
```

### Processing Failures

#### "Orbit files not found"
```bash
# Download orbit files
mkdir -p /data/gmtsar_orbits
wget https://topex.ucsd.edu/gmtsar/tar/ORBITS.tar -O /data/gmtsar_orbits/ORBITS.tar
cd /data/gmtsar_orbits && tar -xf ORBITS.tar
```

#### "DEM file too small or corrupted"
```bash
# Regenerate DEM
generate-dem.sh -120 -119 37 38 /tmp/dem_regenerated.grd

# Verify GMT is working
gmt --version
gmt grdinfo /tmp/dem_regenerated.grd
```

#### "Alignment failed"
- Check that reference and secondary granules are from the same track
- Verify temporal baseline is reasonable (typically 6-24 days for Sentinel-1)
- Ensure both images have same processing level (SLC)

#### "Unwrapping failed" (non-critical)
- Lower coherence threshold: `SNAPHU_COHERENCE_THRESHOLD=0.05`
- Skip unwrapping: set `ENABLE_UNWRAPPING=false`
- Results will still include wrapped phase

---

## 🔐 Security Considerations

1. **File Permissions**: Ensure GMTSAR working directories are not world-readable
2. **API Keys**: Store ESA/NASA credentials in secrets, not in code
3. **Network**: Run GMTSAR container on isolated network in production
4. **Resource Limits**: Set Docker memory/CPU limits to prevent resource exhaustion
5. **Rate Limiting**: Implement job queue rate limiting (already configured)

---

## 📈 Performance Optimization

### Parallel Processing
```typescript
// Configured in insarWorker.ts
export const insarWorker = new Worker<InSARJobData>(
  'insar-processing',
  processInSARJob,
  {
    concurrency: 5,  // Process 5 jobs in parallel
    limiter: {
      max: 10,       // Max 10 jobs
      duration: 60000 // per minute
    },
  }
);
```

### Caching
- DEM files cached automatically (30 day retention)
- Orbit files cached in orbit_cache directory
- Consider enabling `KEEP_INTERMEDIATE_FILES` for debugging

### Memory Management
```bash
# Limit GMTSAR memory usage
export GMTSAR_MEMORY_RATIO=0.75  # Use 75% of available RAM
```

---

## 📚 Additional Resources

- **GMTSAR GitHub**: https://github.com/gmtsar/gmtsar
- **GMTSAR Wiki**: https://github.com/gmtsar/gmtsar/wiki
- **GMTSAR Documentation**: http://topex.ucsd.edu/gmtsar/
- **Sentinel-1 Guide**: https://github.com/gmtsar/2022-unavco-course-gmtsar
- **InSAR Concepts**: https://earthdata.nasa.gov/learn/backgrounders/what-is-sar

---

## ✅ Verification Checklist

- [ ] GMTSAR installed and in PATH
- [ ] GMT installed and working
- [ ] Orbit files downloaded (if using ERS/Envisat)
- [ ] Working directories created with proper permissions
- [ ] Environment variables set in .env
- [ ] PostgreSQL and Redis running
- [ ] Docker images built (if using Docker)
- [ ] Health check returns all services OK
- [ ] Sample job successfully processed
- [ ] Displacement values extracted correctly

---

## 🎯 Next Steps

1. **Prepare Data**: Download Sentinel-1 pairs from ASF Search
2. **Generate DEM**: Create or download appropriate DEM for your area
3. **Create Infrastructure**: Add points to infrastructure in database
4. **Submit Job**: Use API to create InSAR job
5. **Monitor**: Check job status and processing logs
6. **Analyze**: Retrieve displacement results and visualize

---

Last updated: November 2025
GMTSAR Integration v1.0
