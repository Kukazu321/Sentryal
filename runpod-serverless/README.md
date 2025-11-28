# 🐳 SENTRYAL - RunPod Serverless Docker Image

Image Docker pré-configurée avec ISCE3 pour le traitement InSAR sur RunPod Serverless.

## 📁 Structure

```
runpod-serverless/
├── Dockerfile              # Image ISCE3 + CUDA + dependencies
├── handler.py              # Point d'entrée RunPod Serverless
├── isce3_processor.py      # Pipeline complet ISCE3
├── utils.py                # Utilitaires (download, upload, extract)
├── build_push_docker.ps1   # Script build (Windows)
└── build_push_docker.sh    # Script build (Linux/Mac)
```

## 🚀 Build & Deploy

### Windows (PowerShell)
```powershell
# 1. Login DockerHub
docker login

# 2. Build & Push
.\build_push_docker.ps1 -Tag v1.0.0 -DockerUsername sentryal
```

### Linux/Mac
```bash
# 1. Login DockerHub
docker login

# 2. Build & Push
chmod +x build_push_docker.sh
./build_push_docker.sh v1.0.0
```

## ⚙️ Configuration RunPod

1. Aller sur https://www.runpod.io/console/serverless
2. Créer un nouvel endpoint avec:
   - **Docker Image**: `sentryal/isce3-serverless:latest`
   - **GPU**: RTX 4090 (24GB)
   - **Active Workers**: 0
   - **Max Workers**: 3
   - **Idle Timeout**: 5 min

## 📨 API Format

### Input
```json
{
  "job_id": "uuid",
  "infrastructure_id": "uuid",
  "reference_granule": "S1A_...",
  "secondary_granule": "S1A_...",
  "reference_url": "https://...",
  "secondary_url": "https://...",
  "bbox": {"north": 45, "south": 44, "east": 5, "west": 4},
  "points": [{"id": "uuid", "lat": 44.5, "lon": 4.5}],
  "webhook_url": "https://api.sentryal.com/webhook/runpod"
}
```

### Output
```json
{
  "job_id": "uuid",
  "status": "success",
  "results": {
    "displacement_points": [
      {"point_id": "uuid", "displacement_mm": -5.2, "coherence": 0.85}
    ],
    "statistics": {
      "mean_displacement_mm": -4.5,
      "mean_coherence": 0.78
    }
  },
  "processing_time_seconds": 180
}
```

## 🔧 Développement Local

```bash
# Build local
docker build -t isce3-serverless:dev .

# Test local (simulation)
docker run -it --rm isce3-serverless:dev python -c "import isce3; print(isce3.__version__)"
```

## 💰 Coûts Estimés

| GPU | Coût/heure | Temps/job | Coût/job |
|-----|------------|-----------|----------|
| RTX 4090 | $0.74 | ~3-5 min | ~$0.05 |
| A100 40GB | $1.89 | ~2-3 min | ~$0.06 |

**$0 quand aucun job en cours** (Active Workers = 0)
