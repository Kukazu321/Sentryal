# 🚀 QUICKSTART - Démarrer le projet en 5 minutes

## 📋 Prérequis

- **Node.js 18+**
- **Docker & Docker Compose**
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)

---

## 1️⃣ Installation

```powershell
# Cloner le repo (si pas déjà fait)
cd c:\Users\charl\Downloads\Sentryal

# Installer les dépendances
npm run bootstrap
```

---

## 2️⃣ Configuration

### Copier le fichier .env
```powershell
cp .env.example .env
```

### Éditer `.env` avec tes tokens
```env
# PostgreSQL (Docker)
POSTGRES_USER=sentryal
POSTGRES_PASSWORD=changeme
POSTGRES_DB=sentryal_dev

# Backend
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://sentryal:changeme@localhost:5432/sentryal_dev

# Redis (Docker)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# HyP3 API (optionnel pour dev, mock si absent)
HYP3_API_URL=https://hyp3-api.asf.alaska.edu
EARTHDATA_BEARER_TOKEN=ton-token-ici

# Supabase Auth
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_JWT_SECRET=ton-secret-ici
SUPABASE_ANON_KEY=ton-anon-key-ici

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 3️⃣ Démarrer les services

### Option A : Tout avec Docker (recommandé)
```powershell
docker compose up --build
```

Cela démarre :
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend (port 5000)
- Frontend (port 3000)

### Option B : Dev local (sans Docker)
```powershell
# Terminal 1 : PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_USER=sentryal \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=sentryal_dev \
  -p 5432:5432 \
  postgis/postgis:15-3.4

# Terminal 2 : Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 3 : Backend
cd backend
npm run dev

# Terminal 4 : Frontend
cd frontend
npm run dev
```

---

## 4️⃣ Vérifier que tout fonctionne

### Backend
```powershell
curl http://localhost:5000/health
# Doit retourner : {"status":"ok"}
```

### Frontend
Ouvre http://localhost:3000 dans ton navigateur

### Worker
Vérifie les logs du backend :
```
[INFO] InSAR worker initialized and ready to process jobs
```

---

## 5️⃣ Tester le flow complet

### A. Créer une infrastructure (via script)
```powershell
# Éditer test_infra.json avec tes données
{
  "name": "Test Infrastructure",
  "type": "bridge",
  "bbox": {
    "type": "Polygon",
    "coordinates": [[[3.0, 44.0], [3.1, 44.0], [3.1, 44.1], [3.0, 44.1], [3.0, 44.0]]]
  }
}

# Créer l'infrastructure
curl -X POST http://localhost:5000/api/infrastructures \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d @test_infra.json
```

### B. Générer des points (Phase 3 - à venir)
```powershell
# Sera disponible après Phase 3
POST /api/onboarding/generate-grid
```

### C. Lancer un job InSAR
```powershell
curl -X POST http://localhost:5000/api/jobs/process-insar \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"infrastructureId": "uuid-de-ton-infra"}'
```

### D. Vérifier le statut
```powershell
# Le worker poll automatiquement toutes les 30s
# Vérifie les logs du backend

# Ou interroge l'API
curl http://localhost:5000/api/jobs?infrastructureId=uuid \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

### E. Vérifier en DB
```sql
-- Connecte-toi à PostgreSQL
psql postgresql://sentryal:changeme@localhost:5432/sentryal_dev

-- Vérifier les jobs
SELECT id, status, hy3_job_id, created_at, completed_at FROM jobs;

-- Vérifier les déformations (après job terminé)
SELECT COUNT(*), AVG(vertical_displacement_mm) FROM deformations;
```

---

## 🐛 Troubleshooting

### Problème : "Cannot connect to Redis"
```powershell
# Vérifier que Redis tourne
docker ps | grep redis

# Redémarrer Redis
docker restart redis

# Ou démarrer Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### Problème : "Cannot connect to PostgreSQL"
```powershell
# Vérifier que PostgreSQL tourne
docker ps | grep postgres

# Redémarrer PostgreSQL
docker restart postgres

# Vérifier les logs
docker logs postgres
```

### Problème : "Prisma migration failed"
```powershell
cd backend
npx prisma migrate dev
npx prisma generate
```

### Problème : "Worker not starting"
```powershell
# Vérifier les logs du backend
# Doit afficher : "InSAR worker initialized"

# Si absent, vérifier que Redis est accessible
redis-cli ping
# Doit retourner : PONG
```

### Problème : "Job stuck in PENDING"
```powershell
# Vérifier les logs du worker
# Doit afficher : "Processing InSAR job" toutes les 30s

# Vérifier le statut sur HyP3 directement
curl https://hyp3-api.asf.alaska.edu/jobs?job_id=xxx \
  -H "Authorization: Bearer YOUR_EARTHDATA_TOKEN"
```

---

## 📚 Documentation

- **Architecture** : `ARCHITECTURE.md`
- **Roadmap** : `ROADMAP_COMPLETE.md`
- **Status** : `STATUS.md`
- **Phase 4** : `PHASE_4_COMPLETE.md`

---

## 🎯 Prochaines étapes

1. ✅ Vérifier que le worker fonctionne
2. ⏳ Implémenter Phase 3 (génération de grille)
3. ⏳ Implémenter Phase 5 (dashboard)
4. ⏳ Tester end-to-end avec job réel

---

## 💪 Tu es prêt !

Le système est maintenant opérationnel. Le worker va automatiquement :
1. Poller les jobs HyP3 toutes les 30s
2. Télécharger les GeoTIFF quand terminé
3. Parser les déformations
4. Stocker en base de données

**LET'S BUILD THE REVOLUTION ! 🚀**
