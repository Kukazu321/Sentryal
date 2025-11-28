# 🚀 QUICK START - MODE PRODUCTION

## ✅ Configuration Terminée !

Tout est prêt pour utiliser la VRAIE API HyP3 !

---

## 📋 Ce qui a été configuré

### ✅ Token Earthdata
- Token ajouté dans `backend/.env`
- Valide jusqu'au : **5 Juin 2025** (60 jours)
- API HyP3 : **ACTIVÉE** ✅

### ✅ Redis
- Ajouté au `docker-compose.yml`
- Port : `6379`
- Job Queue : **ACTIVÉE** ✅

### ✅ Services
- `HyP3Service` : Mode PRODUCTION
- `GranuleSearchService` : ASF Search API
- `GeoTiffParserService` : Parse GeoTIFF réels
- `JobQueueService` : BullMQ + Redis

---

## 🎯 DÉMARRAGE EN 2 COMMANDES

### 1️⃣ Démarrer Redis

```powershell
docker-compose up -d redis
```

**Vérification :**
```powershell
docker ps
# Tu dois voir : sentryal-redis-1
```

---

### 2️⃣ Démarrer le Backend

```powershell
cd backend
npm run dev
```

**Tu verras :**
```
[INFO] HyP3Service running in PRODUCTION mode with Bearer token
[INFO] GranuleSearchService running with ASF Search API
[INFO] Server listening on port 5000
```

**Si tu vois "MOCK mode"** → Le token n'est pas chargé, redémarre le backend.

---

## 🧪 TESTER PHASE 4 PRODUCTION

### Option A : Script Automatique (RECOMMANDÉ)

```powershell
.\test_phase4_production.ps1
```

**Ce que ça fait :**
1. ✅ Crée infrastructure
2. ✅ Génère grille (3750 points)
3. ✅ Recherche granules Sentinel-1 (ASF Search API)
4. ✅ Crée job HyP3 (VRAIE API)
5. ✅ Poll status (toutes les 10s)
6. ✅ Download GeoTIFF
7. ✅ Parse déformations
8. ✅ Affiche résultats

**Durée :**
- Mode Mock : ~3 minutes
- Mode Production : ~5-15 minutes (traitement InSAR réel)

---

### Option B : Requêtes Manuelles

#### 1. Créer Infrastructure

```powershell
$token = "TON_SUPABASE_TOKEN"
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$infraBody = @{
    name = "Mon Pont"
    geom = @{
        type = "LineString"
        coordinates = @(@(6.3, 44.5), @(6.35, 44.55))
    }
} | ConvertTo-Json -Depth 10

$infra = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:5000/api/infrastructures" `
    -Headers $headers -Body $infraBody

$infraId = $infra.id
```

#### 2. Générer Grille

```powershell
$gridBody = @{
    infrastructureId = $infraId
    mode = "DRAW"
    polygon = @{
        type = "Polygon"
        coordinates = @(@(
            @(6.3, 44.5), @(6.35, 44.5),
            @(6.35, 44.55), @(6.3, 44.55),
            @(6.3, 44.5)
        ))
    }
} | ConvertTo-Json -Depth 10

$grid = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:5000/api/onboarding/generate-grid" `
    -Headers $headers -Body $gridBody
```

#### 3. Créer Job InSAR (PRODUCTION)

```powershell
$jobBody = @{
    infrastructureId = $infraId
    dateRange = @{
        start = "2024-01-01"
        end = "2024-12-31"
    }
} | ConvertTo-Json -Depth 10

$job = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:5000/api/jobs/process-insar" `
    -Headers $headers -Body $jobBody

$jobId = $job.jobId
$hy3JobId = $job.hy3JobId
```

**Vérifier le mode :**
```powershell
if ($hy3JobId -match "^mock-") {
    Write-Host "MODE MOCK" -ForegroundColor Yellow
} else {
    Write-Host "MODE PRODUCTION - Job HyP3 réel!" -ForegroundColor Green
}
```

#### 4. Vérifier Status

```powershell
# Toutes les 10 secondes
$status = Invoke-RestMethod -Method Get `
    -Uri "http://localhost:5000/api/jobs/$jobId" `
    -Headers $headers

Write-Host "Status: $($status.status)"
# PENDING → RUNNING → SUCCEEDED
```

#### 5. Récupérer Déformations

```powershell
$deformations = Invoke-RestMethod -Method Get `
    -Uri "http://localhost:5000/api/deformations?infrastructureId=$infraId" `
    -Headers $headers

Write-Host "Déformations: $($deformations.count)"
Write-Host "Moyenne: $($deformations.stats.avgDisplacementMm) mm"
```

---

## 🔍 VÉRIFIER QUE TOUT FONCTIONNE

### ✅ Checklist

| Vérification | Commande | Résultat Attendu |
|--------------|----------|------------------|
| Redis actif | `docker ps` | `sentryal-redis-1` |
| Backend mode prod | Logs backend | `PRODUCTION mode with Bearer token` |
| Token valide | Créer job InSAR | `hy3JobId` ne commence PAS par `mock-` |
| ASF Search | Créer job InSAR | Logs: `Found Sentinel-1 granules` |
| HyP3 API | Créer job InSAR | Logs: `HyP3 job created successfully` |

---

## 🎯 CE QUI SE PASSE EN PRODUCTION

### Flow Complet

```
1. POST /api/jobs/process-insar
   ↓
2. Calcul bbox infrastructure
   ↓
3. ASF Search API → Recherche granules Sentinel-1
   ↓
4. Sélection paire InSAR (quality score)
   ↓
5. HyP3 API → Création job InSAR
   ↓
6. BullMQ → Polling asynchrone (30s)
   ↓
7. HyP3 → Traitement InSAR (5-15 min)
   ↓
8. Download GeoTIFF (los_disp.tif, corr.tif)
   ↓
9. Parse GeoTIFF → Extract déformations
   ↓
10. Batch insert PostgreSQL
   ↓
11. GET /api/deformations → Résultats
```

---

## 📊 DIFFÉRENCES MODE MOCK vs PRODUCTION

| Aspect | Mode Mock | Mode Production |
|--------|-----------|-----------------|
| **Granules** | 3 paires fictives | ASF Search API réelle |
| **HyP3 Job** | ID mock | ID réel NASA ASF |
| **Traitement** | Simulation 3 min | Vrai InSAR 5-15 min |
| **GeoTIFF** | Données générées | Vrais fichiers NASA |
| **Déformations** | Distribution aléatoire | Vraies déformations terrain |
| **Coût** | Gratuit | Gratuit (usage recherche) |

---

## 🚨 TROUBLESHOOTING

### ❌ "MOCK mode" dans les logs

**Cause :** Token Earthdata non chargé

**Solution :**
```powershell
# Vérifier .env
cat backend\.env | Select-String "EARTHDATA"

# Doit afficher :
# EARTHDATA_BEARER_TOKEN=eyJ0eXAiOiJKV1Qi...

# Redémarrer backend
cd backend
npm run dev
```

---

### ❌ "No suitable Sentinel-1 pairs found"

**Cause :** Pas de granules pour cette zone/période

**Solution :**
```powershell
# Essayer une zone différente (ex: Alpes)
$polygon = @{
    type = "Polygon"
    coordinates = @(@(
        @(6.3, 44.5), @(6.35, 44.5),
        @(6.35, 44.55), @(6.3, 44.55),
        @(6.3, 44.5)
    ))
}

# Ou élargir la période
$dateRange = @{
    start = "2023-01-01"
    end = "2024-12-31"
}
```

---

### ❌ Redis connection error

**Cause :** Redis non démarré

**Solution :**
```powershell
# Démarrer Redis
docker-compose up -d redis

# Vérifier
docker ps | Select-String "redis"
```

---

## 📝 LOGS À SURVEILLER

### ✅ Logs Normaux (Production)

```
[INFO] HyP3Service running in PRODUCTION mode with Bearer token
[INFO] GranuleSearchService running with ASF Search API
[INFO] Searching for Sentinel-1 granules
[INFO] Found Sentinel-1 granules: 15
[INFO] Selected InSAR pair: quality=0.92
[INFO] Creating HyP3 InSAR job
[INFO] HyP3 job created successfully: jobId=abc-123-def
[INFO] Job added to polling queue
[INFO] Polling HyP3 job status: PENDING
[INFO] Polling HyP3 job status: RUNNING
[INFO] Polling HyP3 job status: SUCCEEDED
[INFO] Downloading displacement GeoTIFF
[INFO] Parsing displacement GeoTIFF
[INFO] GeoTIFF metadata extracted: 1024x768
[INFO] Deformations inserted successfully: 3750
```

### ⚠️ Logs Mock (Dev)

```
[INFO] HyP3Service running in MOCK mode (no EARTHDATA_BEARER_TOKEN)
[INFO] GranuleSearchService running in MOCK mode
[INFO] Generating MOCK InSAR pairs
[INFO] MOCK InSAR pairs generated: 3
```

---

## 🎉 SUCCÈS !

Si tu vois dans les logs :
```
[INFO] HyP3Service running in PRODUCTION mode with Bearer token
[INFO] HyP3 job created successfully
```

**TU ES EN MODE PRODUCTION ! 🚀**

Ton SaaS utilise maintenant :
- ✅ Vraie API HyP3 (NASA ASF)
- ✅ Vraie recherche granules (ASF Search)
- ✅ Vrai traitement InSAR
- ✅ Vraies déformations terrain

---

## 📞 BESOIN D'AIDE ?

1. Vérifie les logs backend
2. Vérifie `docker ps` (Redis actif ?)
3. Vérifie `backend/.env` (Token présent ?)
4. Lance `.\test_phase4_production.ps1`

**Tout devrait fonctionner ! 🔥**
