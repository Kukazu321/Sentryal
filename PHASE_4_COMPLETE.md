# ✅ PHASE 4 COMPLÈTE : Intégration HyP3 + Worker + Parser GeoTIFF

## 🎯 Objectif

Automatiser complètement le traitement InSAR :
1. Créer un job HyP3
2. Polling automatique du statut
3. Téléchargement des GeoTIFF
4. Parsing des déformations
5. Stockage en base de données

---

## 📁 Fichiers créés

### 1. `backend/src/workers/insarWorker.ts`
**Worker BullMQ pour polling et traitement des jobs InSAR**

#### Architecture
```
┌─────────────────┐
│  API Route      │ POST /api/jobs/process-insar
│  (jobs.ts)      │ → Crée job HyP3
└────────┬────────┘ → Ajoute à la queue
         │
         ↓
┌─────────────────┐
│  BullMQ Queue   │ Redis-backed
│  (insarQueue)   │ → Stocke job IDs
└────────┬────────┘
         │
         ↓ (polling toutes les 30s)
┌─────────────────┐
│  Worker         │ 5 workers en parallèle
│  (insarWorker)  │ → Poll HyP3 API
└────────┬────────┘ → Télécharge GeoTIFF
         │         → Parse déformations
         ↓         → Stocke en DB
┌─────────────────┐
│  PostgreSQL     │
│  (deformations) │
└─────────────────┘
```

#### Fonctionnalités
- ✅ **Polling automatique** : Vérifie le statut toutes les 30s
- ✅ **Retry avec backoff** : 50 tentatives max (25 minutes)
- ✅ **Téléchargement automatique** : GeoTIFF files quand SUCCEEDED
- ✅ **Parsing automatique** : Extraction des déformations
- ✅ **Stockage atomique** : Transaction pour garantir la cohérence
- ✅ **Cleanup** : Suppression des fichiers temporaires (production)
- ✅ **Scalable** : 5 workers en parallèle, rate limiting
- ✅ **Monitoring** : Logs structurés avec Pino

#### Configuration
```typescript
// Queue options
defaultJobOptions: {
  attempts: 50,           // 50 retries max
  backoff: {
    type: 'fixed',
    delay: 30000,         // 30 seconds between polls
  },
}

// Worker options
concurrency: 5,           // 5 jobs in parallel
limiter: {
  max: 10,                // Max 10 jobs per minute
  duration: 60000,        // Respect HyP3 API rate limits
}
```

#### Utilisation
```typescript
import { insarQueue } from './workers/insarWorker';

// Ajouter un job à la queue
await insarQueue.add('process-insar', {
  jobId: 'db-job-uuid',
  hyp3JobId: 'hyp3-job-id',
  infrastructureId: 'infra-uuid',
  createdAt: Date.now(),
});
```

---

### 2. `backend/src/services/geotiffParser.ts`
**Service de parsing des fichiers GeoTIFF InSAR**

#### Fonctionnalités
- ✅ **Parse GeoTIFF** : Lit les fichiers 32-bit floating-point
- ✅ **Conversion lat/lon → pixel** : Transformation affine
- ✅ **Extraction multi-fichiers** : Vertical, LOS, Coherence
- ✅ **Filtrage qualité** : Coherence minimale (default: 0.3)
- ✅ **Conversion unités** : Mètres → Millimètres (précision 0.01mm)
- ✅ **Gestion NoData** : Détection et skip des valeurs invalides
- ✅ **Statistiques** : Min/max/mean/stdDev pour validation
- ✅ **Extraction date** : Parse filename HyP3 (S1AA_YYYYMMDD_YYYYMMDD)

#### Format GeoTIFF HyP3
```
Fichiers générés par HyP3 :
├─ *_vert_disp.tif    → Déplacement vertical (up/down)
├─ *_los_disp.tif     → Déplacement ligne de visée (towards/away)
├─ *_corr.tif         → Cohérence (qualité, 0.0-1.0)
└─ *_unw_phase.tif    → Phase déroulée (avancé)

Format :
- 32-bit floating-point
- Valeurs en MÈTRES
- NoData : -9999 ou NaN
- Géoréférencé (EPSG:4326 ou projection locale)
```

#### Algorithme de conversion lat/lon → pixel
```typescript
// Affine transformation
x = (lon - bbox[0]) / (bbox[2] - bbox[0]) * width
y = (bbox[3] - lat) / (bbox[3] - bbox[1]) * height

// Note: Y est inversé (origine top-left)
```

#### Utilisation
```typescript
import { geotiffParser } from './services/geotiffParser';

// Parse vertical displacement
const deformations = await geotiffParser.parseVerticalDisplacement(
  '/path/to/vert_disp.tif',
  points, // Array<{ id, latitude, longitude }>
  {
    losDisplacementPath: '/path/to/los_disp.tif', // Optional
    coherencePath: '/path/to/corr.tif',           // Optional
    minCoherence: 0.3,                            // Filter low quality
  }
);

// Résultat :
// [
//   {
//     pointId: 'uuid',
//     date: Date,
//     verticalDisplacementMm: 12.45,  // mm (2 décimales)
//     losDisplacementMm: 8.32,        // mm (optionnel)
//     coherence: 0.87,                // 0.0-1.0 (optionnel)
//   },
//   ...
// ]
```

#### Statistiques (debugging)
```typescript
const stats = await geotiffParser.getStatistics('/path/to/vert_disp.tif');
// {
//   min: -15.23,        // mm
//   max: 42.18,         // mm
//   mean: 2.45,         // mm
//   stdDev: 8.12,       // mm
//   noDataCount: 1234,
//   validCount: 98765,
// }
```

---

## 🔄 Flow complet

### 1. Création du job (API)
```typescript
// POST /api/jobs/process-insar
{
  "infrastructureId": "uuid"
}

// Backend :
1. Vérifie que l'infrastructure existe
2. Récupère les points
3. Calcule le bbox agrégé
4. Crée le job HyP3 (hyP3Service.createJob)
5. Stocke en DB (status: PENDING)
6. Ajoute à la queue BullMQ
7. Retourne job_id
```

### 2. Polling (Worker)
```typescript
// Worker BullMQ (toutes les 30s)
1. Poll HyP3 API : GET /jobs?job_id=xxx
2. Update DB : status = PENDING/RUNNING/SUCCEEDED/FAILED
3. Si PENDING/RUNNING : throw error → retry dans 30s
4. Si FAILED : mark as FAILED, stop
5. Si SUCCEEDED : continue au téléchargement
```

### 3. Téléchargement (Worker)
```typescript
// Quand status = SUCCEEDED
1. Récupère les URLs des fichiers (files[])
2. Trouve *_vert_disp.tif (obligatoire)
3. Trouve *_los_disp.tif (optionnel)
4. Trouve *_corr.tif (optionnel)
5. Télécharge dans /tmp/geotiff/{jobId}/
6. Stocke les fichiers sur disque
```

### 4. Parsing (Worker)
```typescript
// Parse GeoTIFF
1. Récupère tous les points de l'infrastructure
2. Ouvre les GeoTIFF (geotiff.js)
3. Lit les rasters (Float32Array)
4. Pour chaque point :
   a. Convertit lat/lon → pixel x/y
   b. Lit la valeur du pixel
   c. Vérifie NoData
   d. Vérifie coherence > 0.3
   e. Convertit mètres → millimètres
5. Retourne array de deformations
```

### 5. Stockage (Worker)
```typescript
// Insert en DB (transaction)
1. BEGIN TRANSACTION
2. Pour chaque deformation :
   INSERT INTO deformations (
     point_id, job_id, date,
     vertical_displacement_mm,
     los_displacement_mm,
     coherence
   ) VALUES (...)
   ON CONFLICT (point_id, date) DO UPDATE
3. COMMIT
4. Update jobs.status = COMPLETED
5. Cleanup fichiers temporaires (production)
```

---

## 🗄️ Schéma de base de données

### Table `deformations`
```sql
CREATE TABLE deformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  vertical_displacement_mm DECIMAL(10, 3),  -- Précision 0.001mm
  los_displacement_mm DECIMAL(10, 3),       -- Optionnel
  coherence DECIMAL(3, 2),                  -- 0.00-1.00
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Contrainte unique : 1 seule déformation par point/date
  UNIQUE (point_id, date)
);

-- Index pour requêtes rapides
CREATE INDEX idx_deformations_point_id ON deformations(point_id);
CREATE INDEX idx_deformations_job_id ON deformations(job_id);
CREATE INDEX idx_deformations_date ON deformations(date);
CREATE INDEX idx_deformations_point_date ON deformations(point_id, date);
```

### Table `jobs` (mise à jour)
```sql
CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'COMPLETED');

ALTER TABLE jobs ADD COLUMN result_files JSONB;
ALTER TABLE jobs ADD COLUMN completed_at TIMESTAMP;

-- result_files format :
-- [
--   {
--     "url": "https://...",
--     "filename": "S1AA_..._vert_disp.tif",
--     "size": 15234567
--   },
--   ...
-- ]
```

---

## 🚀 Démarrage

### 1. Installer Redis (requis pour BullMQ)
```powershell
# Via Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Ou via WSL/Linux
sudo apt install redis-server
redis-server
```

### 2. Variables d'environnement
```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# HyP3 API
HYP3_API_URL=https://hyp3-api.asf.alaska.edu
EARTHDATA_BEARER_TOKEN=your-token-here

# Mode dev (mock si pas de token)
NODE_ENV=development
```

### 3. Démarrer le worker
```typescript
// backend/src/index.ts
import './workers/insarWorker'; // Import pour démarrer le worker

// Le worker démarre automatiquement et écoute la queue
```

### 4. Tester le flow complet
```powershell
# 1. Créer un job InSAR
curl -X POST http://localhost:5000/api/jobs/process-insar \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"infrastructureId": "uuid"}'

# 2. Le worker poll automatiquement toutes les 30s

# 3. Vérifier les logs
# Logs du worker :
# - "Processing InSAR job"
# - "HyP3 job status retrieved"
# - "Job succeeded, processing results"
# - "Downloaded vertical displacement file"
# - "Parsed deformations from GeoTIFF"
# - "Stored deformations in database"
# - "InSAR job processing completed successfully"

# 4. Vérifier en DB
SELECT * FROM jobs WHERE id = 'job-uuid';
SELECT * FROM deformations WHERE job_id = 'job-uuid';
```

---

## 📊 Monitoring

### Logs structurés (Pino)
```json
{
  "level": "info",
  "time": "2024-01-18T10:30:00.000Z",
  "jobId": "uuid",
  "hyp3JobId": "hyp3-id",
  "status": "SUCCEEDED",
  "msg": "HyP3 job status retrieved"
}
```

### Métriques importantes
- **Temps de traitement** : De PENDING à COMPLETED
- **Taux de succès** : SUCCEEDED vs FAILED
- **Points valides** : % de points avec données valides
- **Coherence moyenne** : Qualité des données InSAR

### BullMQ Dashboard (optionnel)
```bash
npm install -g bull-board
bull-board --redis redis://localhost:6379
# Ouvre http://localhost:3000
```

---

## 🐛 Debugging

### Problème : Worker ne démarre pas
```bash
# Vérifier Redis
redis-cli ping
# Doit retourner : PONG

# Vérifier les logs
tail -f backend/logs/app.log
```

### Problème : Job reste en PENDING
```bash
# Vérifier le statut HyP3
curl https://hyp3-api.asf.alaska.edu/jobs?job_id=xxx \
  -H "Authorization: Bearer YOUR_TOKEN"

# Vérifier la queue BullMQ
redis-cli
> KEYS bull:insar-processing:*
> HGETALL bull:insar-processing:job-id
```

### Problème : Parsing échoue
```typescript
// Tester le parser directement
import { geotiffParser } from './services/geotiffParser';

const stats = await geotiffParser.getStatistics('/path/to/file.tif');
console.log(stats);
// Vérifie min/max/mean pour détecter les anomalies
```

---

## ⚡ Performance

### Optimisations implémentées
- ✅ **Batch insert** : Transaction pour toutes les déformations
- ✅ **Parallel workers** : 5 workers simultanés
- ✅ **Rate limiting** : Max 10 jobs/minute (respect HyP3 API)
- ✅ **Cleanup automatique** : Suppression fichiers temporaires
- ✅ **Index DB** : Index sur point_id, date pour requêtes rapides

### Benchmarks (estimés)
- **Polling overhead** : ~100ms par poll
- **Download GeoTIFF** : ~5-10s pour 3 fichiers (15MB chacun)
- **Parsing** : ~2-5s pour 5000 points
- **DB insert** : ~1-3s pour 5000 déformations
- **Total** : ~10-20s après que HyP3 ait terminé

---

## 🔐 Sécurité

### Gestion des tokens
- ✅ Bearer token stocké en env (pas en DB)
- ✅ Pas de token dans les logs
- ✅ Validation des URLs de téléchargement

### Isolation
- ✅ Fichiers temporaires dans /tmp/{jobId}/ (isolés)
- ✅ Cleanup automatique après traitement
- ✅ Validation des données avant insertion

---

## 📝 TODO (Améliorations futures)

### Phase 4.1 : Webhooks HyP3
- [ ] Route `/api/webhooks/hyp3-callback`
- [ ] Validation signature HyP3
- [ ] Traitement immédiat (pas de polling)

### Phase 4.2 : Notifications
- [ ] WebSocket pour notifier le frontend
- [ ] Email quand job terminé
- [ ] Push notifications (mobile)

### Phase 4.3 : Cache
- [ ] Cache Redis pour les statistiques
- [ ] Cache des GeoTIFF parsés
- [ ] Invalidation automatique

### Phase 4.4 : Monitoring avancé
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] Alertes Sentry

---

## ✅ Checklist Phase 4

- [x] Worker BullMQ créé
- [x] Parser GeoTIFF créé
- [x] Polling automatique implémenté
- [x] Téléchargement automatique implémenté
- [x] Parsing automatique implémenté
- [x] Stockage en DB implémenté
- [x] Gestion des erreurs
- [x] Logs structurés
- [x] Documentation complète
- [ ] Tests unitaires (Phase 8)
- [ ] Tests d'intégration (Phase 8)

---

## 🎯 Prochaine étape : PHASE 5 (Dashboard)

Maintenant que les données sont en DB, on peut créer le dashboard pour les visualiser !

**Fichiers à créer :**
- `backend/src/routes/dashboard.ts` - API pour récupérer les déformations
- `frontend/src/components/InfrastructureMap.tsx` - Carte interactive
- `frontend/src/components/Heatmap.tsx` - Heatmap des déformations
- `frontend/src/pages/dashboard/[id].tsx` - Page dashboard

**Voir `PHASE_5_DASHBOARD.md` pour les détails.**
