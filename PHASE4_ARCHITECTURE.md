# PHASE 4 : INTÉGRATION HyP3 & TRAITEMENT INSAR
## Architecture de niveau EXCEPTIONNEL 🚀

---

## 🎯 Objectif Phase 4

Intégrer **NASA ASF HyP3** (Hybrid Pluggable Processing Pipeline) pour le traitement InSAR (Interferometric Synthetic Aperture Radar) et l'extraction des déformations du sol en millimètres.

**Résultat attendu** : Système production-ready capable de :
1. Soumettre des jobs InSAR à HyP3 avec authentification OAuth
2. Gérer le polling asynchrone avec queue (BullMQ + Redis)
3. Télécharger et parser les résultats (CSV/GeoTIFF)
4. Extraire les déformations par point et date
5. Stocker en DB avec relations optimisées
6. Webhook pour notifications HyP3
7. Mode mock dev avec données réalistes

---

## 🏗️ Architecture Technique

### Stack Phase 4

```
Backend Services:
├── HyP3Service (OAuth + API calls)
├── JobQueueService (BullMQ + Redis)
├── InSARParserService (CSV/GeoTIFF)
├── DeformationService (DB operations)
└── WebhookService (HyP3 callbacks)

Infrastructure:
├── Redis (queue + cache)
├── BullMQ (job processing)
└── PostgreSQL (deformations table)

External APIs:
├── NASA Earthdata OAuth
├── ASF HyP3 API
└── S3 (résultats HyP3)
```

### Flow de traitement InSAR

```
1. USER → POST /api/jobs/process-insar
   ↓
2. Backend calcule bbox agrégé (PostGIS ST_Envelope)
   ↓
3. HyP3Service.createJob() → NASA HyP3 API
   ↓
4. Job stocké en DB (status: PENDING)
   ↓
5. BullMQ queue → Worker polling (30s interval)
   ↓
6. HyP3 job status: SUCCEEDED
   ↓
7. Download CSV/GeoTIFF from S3
   ↓
8. InSARParserService extracts deformations
   ↓
9. Batch insert deformations table
   ↓
10. Update job status: COMPLETED
    ↓
11. Frontend notifié (WebSocket ou polling)
```

---

## 📊 Schéma de données

### Table `deformations` (nouvelle)

```sql
CREATE TABLE deformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  displacement_mm DECIMAL(10, 3) NOT NULL,
  coherence DECIMAL(5, 3),
  velocity_mm_year DECIMAL(10, 3),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_deformations_point (point_id),
  INDEX idx_deformations_job (job_id),
  INDEX idx_deformations_date (date),
  UNIQUE (point_id, job_id, date)
);
```

### Table `jobs` (mise à jour)

```sql
ALTER TABLE jobs ADD COLUMN hy3_job_type VARCHAR(50);
ALTER TABLE jobs ADD COLUMN hy3_product_urls JSONB;
ALTER TABLE jobs ADD COLUMN error_message TEXT;
ALTER TABLE jobs ADD COLUMN retry_count INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN processing_time_ms INT;
```

---

## 🔐 HyP3 API - Authentification

### OAuth Earthdata Flow

```typescript
// 1. Get OAuth token
POST https://urs.earthdata.nasa.gov/oauth/token
Body: {
  grant_type: 'client_credentials',
  client_id: process.env.EARTHDATA_CLIENT_ID,
  client_secret: process.env.EARTHDATA_CLIENT_SECRET
}

// 2. Use token for HyP3 API
Authorization: Bearer {access_token}
```

### HyP3 Job Creation

```typescript
POST https://hyp3-api.asf.alaska.edu/jobs
Headers: {
  Authorization: Bearer {token},
  Content-Type: application/json
}
Body: {
  job_type: 'INSAR_GAMMA',
  job_parameters: {
    granules: ['S1A_IW_SLC__1SDV_...', 'S1A_IW_SLC__1SDV_...'],
    looks: '20x4',
    include_dem: true,
    include_inc_map: true,
    include_los_displacement: true
  }
}

Response: {
  job_id: 'abc123',
  status_code: 'PENDING',
  request_time: '2025-11-05T16:00:00Z'
}
```

### HyP3 Job Polling

```typescript
GET https://hyp3-api.asf.alaska.edu/jobs/{job_id}

Response: {
  job_id: 'abc123',
  status_code: 'SUCCEEDED', // PENDING | RUNNING | SUCCEEDED | FAILED
  files: [
    {
      url: 'https://hyp3-download.asf.alaska.edu/.../displacement.csv',
      size: 1024000,
      filename: 'displacement.csv'
    },
    {
      url: 'https://hyp3-download.asf.alaska.edu/.../coherence.tif',
      size: 5120000,
      filename: 'coherence.tif'
    }
  ],
  expiration_time: '2025-11-12T16:00:00Z'
}
```

---

## 🚀 Services à implémenter

### 1. HyP3Service (production-ready)

**Responsabilités:**
- OAuth token management (refresh automatique)
- Job creation avec retry logic
- Job status polling
- Error handling (rate limits, timeouts)
- Mock mode pour dev

**Méthodes:**
```typescript
class HyP3Service {
  async authenticate(): Promise<string>
  async createInSARJob(bbox: BBox, dateRange: DateRange): Promise<JobResponse>
  async getJobStatus(jobId: string): Promise<JobStatus>
  async downloadResults(urls: string[]): Promise<Buffer[]>
  async refreshToken(): Promise<void>
}
```

### 2. JobQueueService (BullMQ + Redis)

**Responsabilités:**
- Queue management
- Worker processing
- Job retry logic
- Progress tracking
- Dead letter queue

**Queues:**
```typescript
- insar-processing (priority queue)
- insar-polling (scheduled jobs)
- insar-download (parallel downloads)
- insar-parsing (CPU intensive)
```

### 3. InSARParserService

**Responsabilités:**
- CSV parsing (PapaParse)
- GeoTIFF parsing (geotiff.js)
- Coordinate matching (point_id lookup)
- Data validation
- Batch preparation

**Format CSV attendu:**
```csv
lat,lon,date,displacement_mm,coherence,velocity_mm_year
46.0421,5.7193,2025-01-15,-2.3,0.85,5.2
46.0421,5.7198,2025-01-15,-1.8,0.92,4.7
```

### 4. DeformationService

**Responsabilités:**
- Batch insert deformations
- Time-series queries
- Statistical aggregations
- Anomaly detection

**Méthodes:**
```typescript
class DeformationService {
  async batchInsert(deformations: Deformation[]): Promise<void>
  async getTimeSeries(pointId: string): Promise<TimeSeries>
  async getAnomalies(infrastructureId: string, threshold: number): Promise<Anomaly[]>
  async getStatistics(infrastructureId: string): Promise<Stats>
}
```

### 5. WebhookService

**Responsabilités:**
- Webhook endpoint sécurisé
- Signature verification
- Event processing
- Retry handling

---

## 🎭 Mode Mock Dev

Pour développer sans accès HyP3 réel, mode mock avec données réalistes :

```typescript
class MockHyP3Service extends HyP3Service {
  async createInSARJob(): Promise<JobResponse> {
    // Simulate API delay
    await sleep(500);
    
    return {
      job_id: faker.string.uuid(),
      status_code: 'PENDING',
      request_time: new Date().toISOString()
    };
  }
  
  async getJobStatus(jobId: string): Promise<JobStatus> {
    // Simulate processing time (2-5 minutes)
    const elapsed = Date.now() - this.jobStartTime;
    
    if (elapsed < 120000) return { status_code: 'PENDING' };
    if (elapsed < 180000) return { status_code: 'RUNNING' };
    
    return {
      status_code: 'SUCCEEDED',
      files: [
        { url: 'mock://displacement.csv', filename: 'displacement.csv' }
      ]
    };
  }
  
  async downloadResults(): Promise<Buffer[]> {
    // Generate realistic CSV with normal distribution
    const csv = this.generateMockCSV();
    return [Buffer.from(csv)];
  }
  
  private generateMockCSV(): string {
    // Normal distribution: mean=0mm, stddev=2mm
    // 68% des points entre -2mm et +2mm
    // 95% des points entre -4mm et +4mm
    const points = this.getInfrastructurePoints();
    const dates = this.generateDateRange();
    
    const rows = points.flatMap(point => 
      dates.map(date => ({
        lat: point.lat,
        lon: point.lng,
        date: date.toISOString().split('T')[0],
        displacement_mm: normalRandom(0, 2), // mean=0, stddev=2
        coherence: Math.random() * 0.3 + 0.7, // 0.7-1.0
        velocity_mm_year: normalRandom(0, 5) // mean=0, stddev=5
      }))
    );
    
    return Papa.unparse(rows);
  }
}
```

---

## 🔄 Polling Strategy

### Option 1: BullMQ Delayed Jobs (RECOMMANDÉ)

```typescript
// Create polling job
await pollingQueue.add('poll-hy3-job', {
  jobId: hy3JobId,
  dbJobId: dbJob.id,
  attempt: 0
}, {
  delay: 30000, // 30 seconds
  attempts: 100, // Max 50 minutes
  backoff: {
    type: 'exponential',
    delay: 30000
  }
});

// Worker
pollingQueue.process('poll-hy3-job', async (job) => {
  const status = await hyP3Service.getJobStatus(job.data.jobId);
  
  if (status.status_code === 'SUCCEEDED') {
    // Download and process
    await processResults(job.data.dbJobId, status.files);
    return { completed: true };
  }
  
  if (status.status_code === 'FAILED') {
    throw new Error('HyP3 job failed');
  }
  
  // Still processing, retry
  throw new Error('Still processing');
});
```

### Option 2: Cron Job (simple, moins scalable)

```typescript
// Every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  const pendingJobs = await db.jobs.findMany({
    where: { status: 'PROCESSING' }
  });
  
  for (const job of pendingJobs) {
    await checkAndUpdateJob(job);
  }
});
```

---

## 📦 Dépendances à installer

```bash
npm install --save bull bullmq ioredis
npm install --save papaparse geotiff
npm install --save @faker-js/faker
npm install --save-dev @types/papaparse @types/geotiff
```

---

## 🎯 Routes API Phase 4

### POST `/api/jobs/process-insar`

**Request:**
```json
{
  "infrastructureId": "uuid",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2025-01-01"
  },
  "options": {
    "looks": "20x4",
    "includeDEM": true
  }
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "hy3JobId": "abc123",
  "status": "PENDING",
  "estimatedDuration": "3-5 minutes",
  "pointsCount": 3750,
  "bbox": {
    "type": "Polygon",
    "coordinates": [...]
  }
}
```

### GET `/api/jobs/:jobId/status`

**Response:**
```json
{
  "jobId": "uuid",
  "status": "PROCESSING",
  "progress": 45,
  "hy3Status": "RUNNING",
  "startedAt": "2025-11-05T16:00:00Z",
  "estimatedCompletion": "2025-11-05T16:05:00Z"
}
```

### GET `/api/deformations/:infrastructureId`

**Query params:**
- `startDate` (optional)
- `endDate` (optional)
- `pointId` (optional)

**Response:**
```json
{
  "infrastructureId": "uuid",
  "pointsCount": 3750,
  "deformationsCount": 112500,
  "dateRange": {
    "start": "2024-01-01",
    "end": "2025-01-01"
  },
  "statistics": {
    "meanDisplacement": -0.5,
    "stdDeviation": 2.1,
    "maxDisplacement": 8.3,
    "minDisplacement": -7.2
  },
  "timeSeries": [
    {
      "date": "2024-01-15",
      "meanDisplacement": -0.3,
      "pointsCount": 3750
    }
  ]
}
```

### POST `/api/webhooks/hy3-callback`

**Headers:**
- `X-HyP3-Signature`: HMAC signature

**Body:**
```json
{
  "job_id": "abc123",
  "status": "SUCCEEDED",
  "timestamp": "2025-11-05T16:05:00Z",
  "files": [...]
}
```

---

## 🧪 Tests Phase 4

### Tests unitaires
- HyP3Service OAuth flow
- Mock job creation/polling
- CSV parsing avec données réalistes
- Batch insert performance

### Tests d'intégration
- End-to-end job processing
- Queue worker behavior
- Webhook handling
- Error scenarios

### Tests de performance
- 10k points × 30 dates = 300k deformations
- Batch insert < 5s
- Time-series query < 500ms

---

## 🚀 Prêt à implémenter !

Cette architecture est:
- ✅ **Production-ready** (retry, error handling, monitoring)
- ✅ **Scalable** (queue, workers, batch processing)
- ✅ **Testable** (mock mode, unit tests)
- ✅ **Maintenable** (services séparés, clean code)
- ✅ **Performante** (batch insert, indexes, caching)

**Let's fucking build this masterpiece! 🔥**
