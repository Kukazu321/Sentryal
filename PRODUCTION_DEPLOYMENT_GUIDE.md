# 🚀 SENTRYAL - Guide de Déploiement Production

## Architecture Finale (Zero-Cost Idle)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SENTRYAL PRODUCTION ARCHITECTURE                     │
│                              (Pay-per-use only)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────────┐
│                 │      │                 │      │                         │
│     VERCEL      │      │    RAILWAY      │      │   RUNPOD SERVERLESS     │
│    (Frontend)   │      │    (Backend)    │      │      (GPU ISCE3)        │
│                 │      │                 │      │                         │
│   FREE TIER     │──────│   $5/month      │──────│   $0 idle               │
│                 │      │   (usage)       │      │   ~$0.50/job            │
│  - Next.js SSR  │      │  - Express API  │      │  - ISCE3 Processing     │
│  - CDN global   │      │  - PostgreSQL   │      │  - Auto-scale 0→N      │
│  - Auto-deploy  │      │  - Redis        │      │  - RTX 4090             │
│                 │      │  - BullMQ       │      │  - Docker pré-config    │
└─────────────────┘      └─────────────────┘      └─────────────────────────┘
         │                        │                          │
         │                        │                          │
    git push              git push                    API call
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────────┐
│    GitHub       │      │    GitHub       │      │      DockerHub          │
│  frontend repo  │      │  backend repo   │      │  sentryal/isce3-server  │
└─────────────────┘      └─────────────────┘      └─────────────────────────┘
```

## 💰 Coûts Estimés

| Service | Coût mensuel | Notes |
|---------|--------------|-------|
| Vercel | **$0** | Free tier (100GB bandwidth) |
| Railway | **$5** | Usage-based (PostgreSQL + Redis) |
| RunPod Serverless | **$0-20** | ~$0.50/job, $0 quand inactif |
| DockerHub | **$0** | Free tier (1 image) |
| **TOTAL** | **$5-25/mois** | vs $144/mois avec pods 24/7 |

## 📋 Checklist Déploiement

### Étape 1: Préparer DockerHub
```bash
# 1. Créer compte sur hub.docker.com
# 2. Login Docker
docker login

# 3. Build & Push l'image ISCE3
cd runpod-serverless
.\build_push_docker.ps1 -Tag v1.0.0
```

### Étape 2: Créer Endpoint RunPod Serverless

1. Aller sur https://www.runpod.io/console/serverless
2. Cliquer "New Endpoint"
3. Configuration:
   ```
   Name:              sentryal-isce3
   Docker Image:      sentryal/isce3-serverless:latest
   GPU Type:          RTX 4090 (24GB)
   Active Workers:    0
   Max Workers:       3
   Idle Timeout:      5 minutes
   Max Request Time:  900 seconds (15 min)
   ```
4. Copier l'**Endpoint ID** généré
5. Aller dans "API Keys" et copier votre **API Key**

### Étape 3: Déployer Backend sur Railway

1. Aller sur https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Sélectionner le repo backend
4. Ajouter les services:
   - **PostgreSQL** (avec PostGIS)
   - **Redis**

5. Variables d'environnement:
```env
# Database (auto-set par Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (auto-set par Railway)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

# RunPod Serverless
RUNPOD_API_KEY=rpa_XXXXXXXXXX
RUNPOD_ENDPOINT_ID=XXXXX-XXXXX

# Auth
JWT_SECRET=your-super-secret-key
NEXTAUTH_SECRET=your-nextauth-secret

# ASF/Earthdata (pour téléchargement Sentinel-1)
EARTHDATA_USERNAME=your_username
EARTHDATA_PASSWORD=your_password
EARTHDATA_BEARER_TOKEN=your_token

# Webhook (pour résultats async)
WEBHOOK_BASE_URL=https://your-railway-app.railway.app

# Node
NODE_ENV=production
PORT=5000
```

6. Build command: `npm run build`
7. Start command: `npm run start:serverless`

### Étape 4: Déployer Frontend sur Vercel

1. Aller sur https://vercel.com
2. "New Project" → Import depuis GitHub
3. Sélectionner le repo frontend
4. Framework Preset: **Next.js**
5. Variables d'environnement:
```env
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxxxx
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret
```

6. Deploy!

## 🔧 Configuration Backend pour Serverless

Ajouter ce script npm dans `backend/package.json`:
```json
{
  "scripts": {
    "start:serverless": "node -r dotenv/config dist/index.js",
    "start:worker:serverless": "node -r dotenv/config dist/workers/insarWorkerServerless.js"
  }
}
```

Et dans `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm run start:serverless & npm run start:worker:serverless",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## 🔄 Workflow de Production

```
1. User soumet job InSAR via Frontend
                    │
                    ▼
2. Backend reçoit requête (Railway)
   - Vérifie auth
   - Cherche paires Sentinel-1 (ASF)
   - Crée job en DB
   - Ajoute à BullMQ
                    │
                    ▼
3. Worker détecte nouveau job
   - Récupère metadata
   - Prépare payload
   - Soumet à RunPod Serverless API
                    │
                    ▼
4. RunPod démarre un worker
   - Charge image Docker ISCE3
   - Télécharge granules depuis ASF
   - Execute ISCE3 processing
   - Retourne résultats (webhook)
                    │
                    ▼
5. Webhook reçoit résultats
   - Stocke déplacements en DB
   - Calcule vélocités
   - Met à jour statut job
                    │
                    ▼
6. Frontend affiche résultats
   - Map avec déformations
   - Graphiques
   - Export
```

## 📊 Monitoring

### Railway Dashboard
- CPU/Memory usage
- Request logs
- Error tracking

### RunPod Dashboard
- Jobs queue status
- Worker utilization
- Costs tracking

### Logs
```bash
# Railway logs
railway logs

# Voir logs spécifiques
railway logs --filter "error"
```

## 🚨 Troubleshooting

### RunPod job timeout
```
Erreur: Job exceeded max execution time
```
**Solution**: Augmenter `Max Request Time` dans RunPod endpoint settings.

### Image Docker non trouvée
```
Erreur: Failed to pull image
```
**Solution**: Vérifier que l'image est publique sur DockerHub ou utiliser un registry privé avec credentials.

### Database connection refused
```
Erreur: ECONNREFUSED
```
**Solution**: Vérifier que `DATABASE_URL` inclut `?sslmode=require` pour Railway.

## 📁 Structure des Fichiers Créés

```
runpod-serverless/
├── Dockerfile                 # Image ISCE3 complète
├── handler.py                 # Handler RunPod Serverless
├── isce3_processor.py         # Pipeline ISCE3
├── utils.py                   # Utilitaires (download, upload)
├── build_push_docker.sh       # Script build Linux
└── build_push_docker.ps1      # Script build Windows

backend/src/
├── services/
│   └── runpodServerlessService.ts  # Client API RunPod
├── workers/
│   └── insarWorkerServerless.ts    # Worker BullMQ v2
└── routes/
    └── webhook.ts                   # Endpoint webhook
```

## 🎉 Résultat Final

- **$0** quand tu n'utilises pas Sentryal
- **$5 + ~$0.50/job** quand tu l'utilises
- **Pas de perte d'environnement** (Docker pré-configuré)
- **Auto-scaling** (0→3 workers automatiquement)
- **Pas de maintenance** serveur GPU

---

*Généré automatiquement pour Sentryal Production Deployment*
