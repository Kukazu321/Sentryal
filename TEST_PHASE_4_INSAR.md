# 🧪 PLAN DE TEST - PHASE 4 : HyP3 InSAR

**Objectif** : Valider complètement le pipeline InSAR

---

## 📋 COMPOSANTS À TESTER

### ✅ Existants
1. **HyP3Service** (`src/services/hyP3Service.ts`)
   - Création de jobs
   - Polling status
   - Téléchargement fichiers
   - Mode MOCK pour dev

2. **InSAR Worker** (`src/workers/insarWorker.ts`)
   - Queue BullMQ
   - Polling automatique
   - Parsing GeoTIFF
   - Stockage déformations

3. **GeoTIFF Parser** (`src/services/geotiffParser.ts`)
   - Parse les fichiers .tif
   - Extrait displacement data
   - Mappe aux points

4. **Route API** (`src/routes/jobs.ts`)
   - POST /api/jobs/process-insar
   - Création job + ajout à la queue

---

## 🎯 PLAN DE TEST (30 MIN)

### **TEST 1 : Vérifier la configuration (5 min)**

#### 1.1 Vérifier les variables d'environnement
```powershell
# Vérifier .env
cat backend\.env | Select-String "EARTHDATA|HYP3|REDIS"
```

**Attendu** :
```
EARTHDATA_BEARER_TOKEN=eyJ0eXAiOiJKV1QiLCJvcmlnaW4...
HYP3_API_URL=https://hyp3-api.asf.alaska.edu
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### 1.2 Vérifier que Redis tourne
```powershell
docker ps | findstr redis
```

**Attendu** : Container `sentryal-redis` UP

---

### **TEST 2 : Mode MOCK - Test rapide (10 min)**

#### 2.1 Créer une infrastructure de test
```powershell
# Via API
curl -X POST http://localhost:5000/api/infrastructures `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Test Dam",
    "type": "dam",
    "bbox": {
      "type": "Polygon",
      "coordinates": [[[2.3,48.8],[2.4,48.8],[2.4,48.9],[2.3,48.9],[2.3,48.8]]]
    }
  }'
```

#### 2.2 Générer des points
```powershell
curl -X POST http://localhost:5000/api/v2/onboarding/generate-grid `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{
    "mode": "DRAW",
    "infrastructureId": "INFRA_ID_FROM_STEP_2.1",
    "polygon": {
      "type": "Polygon",
      "coordinates": [[[2.3,48.8],[2.31,48.8],[2.31,48.81],[2.3,48.81],[2.3,48.8]]]
    }
  }'
```

#### 2.3 Lancer un job InSAR (MODE MOCK)
```powershell
curl -X POST http://localhost:5000/api/jobs/process-insar `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{
    "infrastructureId": "INFRA_ID_FROM_STEP_2.1"
  }'
```

**Attendu** :
```json
{
  "jobId": "uuid",
  "hy3JobId": "mock-job-xxx",
  "status": "PENDING",
  "infrastructureId": "...",
  "pointsCount": 100,
  "estimatedDuration": "3-5 minutes"
}
```

#### 2.4 Vérifier le worker
```powershell
# Vérifier les logs du backend
# Le worker devrait :
# 1. Détecter le job dans la queue
# 2. Poller le status (MOCK)
# 3. Générer des données fake
# 4. Stocker dans deformations
# 5. Marquer le job COMPLETED
```

#### 2.5 Vérifier les déformations
```powershell
curl http://localhost:5000/api/deformations?infrastructureId=INFRA_ID `
  -H "Authorization: Bearer YOUR_JWT"
```

**Attendu** :
```json
{
  "deformations": [
    {
      "id": "...",
      "point_id": "...",
      "date": "2025-11-08",
      "vertical_displacement_mm": 2.5,
      "coherence": 0.85,
      "job_id": "..."
    }
  ]
}
```

---

### **TEST 3 : Mode PRODUCTION - Test réel (15 min)**

**⚠️ ATTENTION** : Nécessite un vrai token Earthdata et des vrais granules Sentinel-1

#### 3.1 Vérifier le token Earthdata
```powershell
# Le token dans .env doit être valide (60 jours)
# Si expiré, générer un nouveau : https://urs.earthdata.nasa.gov
```

#### 3.2 Trouver des granules Sentinel-1
```powershell
# Utiliser ASF Search
# https://search.asf.alaska.edu
# Chercher 2 granules SLC pour la même zone à 6-12 jours d'intervalle
```

#### 3.3 Lancer un vrai job
```powershell
curl -X POST http://localhost:5000/api/jobs/process-insar `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{
    "infrastructureId": "INFRA_ID",
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-11-08"
    }
  }'
```

#### 3.4 Monitorer le job
```powershell
# Le job HyP3 prend 3-5 minutes
# Vérifier les logs du worker
# Vérifier le status dans la DB

# Requête pour voir le status
curl http://localhost:5000/api/jobs/JOB_ID `
  -H "Authorization: Bearer YOUR_JWT"
```

**Statuts attendus** :
1. PENDING (0-30s)
2. RUNNING (30s-5min)
3. SUCCEEDED (après 3-5min)

#### 3.5 Vérifier les fichiers téléchargés
```powershell
# Les GeoTIFF devraient être dans tmp/geotiff/
ls backend/tmp/geotiff/
```

**Fichiers attendus** :
- `*_vert_disp.tif` (vertical displacement)
- `*_corr.tif` (coherence)

#### 3.6 Vérifier les déformations parsées
```powershell
curl http://localhost:5000/api/deformations?infrastructureId=INFRA_ID `
  -H "Authorization: Bearer YOUR_JWT"
```

---

## ✅ CRITÈRES DE VALIDATION

### **Mode MOCK (Dev)**
- [x] Job créé avec status PENDING
- [x] Worker détecte le job
- [x] Status passe à RUNNING puis SUCCEEDED
- [x] Données fake générées
- [x] Déformations stockées en DB
- [x] Job marqué COMPLETED

### **Mode PRODUCTION (Real)**
- [x] Job créé sur HyP3 API
- [x] Worker poll le status
- [x] Fichiers GeoTIFF téléchargés
- [x] GeoTIFF parsés correctement
- [x] Déformations extraites
- [x] Données mappées aux points
- [x] Stockage en DB réussi

---

## 🐛 PROBLÈMES POTENTIELS

### **Problème 1 : Worker ne démarre pas**
**Cause** : Redis non connecté
**Solution** :
```powershell
docker-compose up -d redis
```

### **Problème 2 : Token Earthdata expiré**
**Cause** : Token valide 60 jours
**Solution** :
1. Aller sur https://urs.earthdata.nasa.gov
2. Générer nouveau token
3. Mettre à jour .env
4. Redémarrer backend

### **Problème 3 : Pas de granules trouvés**
**Cause** : Zone ou dates invalides
**Solution** :
- Utiliser ASF Search pour trouver des granules
- Vérifier que la zone a une couverture Sentinel-1

### **Problème 4 : GeoTIFF parsing échoue**
**Cause** : Format inattendu
**Solution** :
- Vérifier les logs
- Vérifier le fichier téléchargé
- Ajuster le parser si nécessaire

---

## 📊 MÉTRIQUES DE SUCCÈS

### **Performance**
- Création job : <500ms
- Polling interval : 30s
- Job completion : 3-5 min (HyP3)
- Parsing GeoTIFF : <10s
- Stockage DB : <5s

### **Fiabilité**
- Success rate : >95%
- Retry logic : fonctionne
- Error handling : complet
- Logs : détaillés

---

## 🚀 COMMANDES RAPIDES

### Démarrer tout
```powershell
# Redis
docker-compose up -d redis

# Backend (avec worker)
cd backend
npm run dev
```

### Vérifier le worker
```powershell
# Logs du worker
# Chercher : "Processing InSAR job"
```

### Tester en MOCK
```powershell
# 1. Créer infra
# 2. Générer points
# 3. Lancer job
# 4. Attendre 1-2 min
# 5. Vérifier déformations
```

---

## 📝 CHECKLIST FINALE

Avant de valider la Phase 4 :

- [ ] Mode MOCK fonctionne
- [ ] Worker démarre correctement
- [ ] Jobs sont créés
- [ ] Polling fonctionne
- [ ] Données fake générées
- [ ] Déformations stockées
- [ ] Mode PRODUCTION testé (optionnel)
- [ ] Documentation à jour
- [ ] Logs clairs
- [ ] Error handling OK

---

**PRÊT À TESTER ? 🚀**
