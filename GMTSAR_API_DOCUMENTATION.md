# GMTSAR API Routes Documentation

## Overview

These API routes manage InSAR job creation and processing using GMTSAR.

## Endpoints

### POST /api/jobs/process-insar

Create a new InSAR job and enqueue it for processing.

**Authentication**: Required (JWT or API Key)

**Authorization**: Must have `write:jobs` scope for the infrastructure

**Request Body**:
```json
{
  "infrastructureId": "uuid",
  "referenceGranule": "S1A_IW_SLC__1SDV_20190704T135158_...",
  "secondaryGranule": "S1A_IW_SLC__1SDV_20190716T135159_...",
  "referenceGranulePath": "/path/to/reference.SAFE",
  "secondaryGranulePath": "/path/to/secondary.SAFE",
  "demPath": "/path/to/dem.grd",
  "bbox": {
    "north": 38.0,
    "south": 37.0,
    "east": -119.0,
    "west": -120.0
  }
}
```

**Response** (201 Created):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "infrastructureId": "5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a",
  "status": "PENDING",
  "referenceGranule": "S1A_IW_SLC__1SDV_20190704T135158_...",
  "secondaryGranule": "S1A_IW_SLC__1SDV_20190716T135159_...",
  "createdAt": "2025-11-22T10:30:00Z",
  "estimatedCompletionTime": "2025-11-22T11:00:00Z",
  "processingStages": [
    {
      "stage": 1,
      "name": "Preprocessing",
      "completed": false
    },
    {
      "stage": 2,
      "name": "Alignment",
      "completed": false
    },
    {
      "stage": 3,
      "name": "Back Geocoding & Topo",
      "completed": false
    },
    {
      "stage": 4,
      "name": "Interferometry & Filtering",
      "completed": false
    },
    {
      "stage": 5,
      "name": "Phase Unwrapping",
      "completed": false
    },
    {
      "stage": 6,
      "name": "Geocoding to Lat/Lon",
      "completed": false
    }
  ]
}
```

**Error Responses**:

- `400 Bad Request`: Invalid input or missing fields
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User doesn't have permission for this infrastructure
- `404 Not Found`: Infrastructure not found
- `409 Conflict`: Another job is already processing for this infrastructure
- `503 Service Unavailable`: GMTSAR not available or Redis not responding

**Example**:
```bash
curl -X POST http://localhost:3000/api/jobs/process-insar \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "infrastructureId": "5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a",
    "referenceGranule": "S1A_IW_SLC__1SDV_20190704T135158_20190704T135225_027968_032877_1C4D.SAFE",
    "secondaryGranule": "S1A_IW_SLC__1SDV_20190716T135159_20190716T135226_028143_032DC3_512B.SAFE",
    "bbox": {
      "north": 38.0,
      "south": 37.0,
      "east": -119.0,
      "west": -120.0
    }
  }'
```

---

### GET /api/jobs/:id

Retrieve job status and progress.

**Authentication**: Required (JWT or API Key)

**Path Parameters**:
- `id` (string, required): Job ID

**Query Parameters**:
- `include` (string, optional): Comma-separated fields to include
  - `deformations`: Include displacement results
  - `stages`: Include processing stage details
  - `metadata`: Include job metadata

**Response** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "infrastructureId": "5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a",
  "status": "PROCESSING",
  "referenceGranule": "S1A_IW_SLC__1SDV_20190704T135158_...",
  "secondaryGranule": "S1A_IW_SLC__1SDV_20190716T135159_...",
  "createdAt": "2025-11-22T10:30:00Z",
  "startedAt": "2025-11-22T10:35:00Z",
  "completedAt": null,
  "progress": {
    "currentStage": 4,
    "completedStages": 3,
    "totalStages": 6,
    "percentComplete": 50
  },
  "processingStages": [
    {
      "stage": 1,
      "name": "Preprocessing",
      "completed": true,
      "startedAt": "2025-11-22T10:35:00Z",
      "completedAt": "2025-11-22T10:37:00Z",
      "output": "SLC files generated"
    },
    {
      "stage": 2,
      "name": "Alignment",
      "completed": true,
      "startedAt": "2025-11-22T10:37:00Z",
      "completedAt": "2025-11-22T10:40:00Z",
      "output": "Images aligned and resampled"
    },
    {
      "stage": 3,
      "name": "Back Geocoding & Topo",
      "completed": true,
      "startedAt": "2025-11-22T10:40:00Z",
      "completedAt": "2025-11-22T10:41:00Z",
      "output": "topo_ra.grd created"
    },
    {
      "stage": 4,
      "name": "Interferometry & Filtering",
      "completed": false,
      "startedAt": "2025-11-22T10:41:00Z"
    }
  ],
  "statistics": {
    "temporalBaseline": 12,
    "perpendicularBaseline": 45.2,
    "meanCoherence": 0.65,
    "highCoherencePoints": 1250,
    "meanDisplacement": -12.5,
    "maxDisplacement": -95.3,
    "minDisplacement": 5.2
  }
}
```

**Error Responses**:
- `404 Not Found`: Job not found
- `401 Unauthorized`: User doesn't have access to this job

**Example**:
```bash
curl http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### GET /api/jobs

List jobs for an infrastructure.

**Authentication**: Required

**Query Parameters**:
- `infrastructureId` (string, required): Infrastructure ID
- `status` (string, optional): Filter by status (PENDING, PROCESSING, SUCCEEDED, FAILED)
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)
- `sort` (string, optional): Sort field (createdAt, startedAt, completedAt)

**Response** (200 OK):
```json
{
  "jobs": [
    {
      "jobId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "SUCCEEDED",
      "createdAt": "2025-11-22T10:30:00Z",
      "completedAt": "2025-11-22T11:05:00Z",
      "processingTime": 2100,
      "pointsProcessed": 2500,
      "meanDisplacement": -12.5
    },
    {
      "jobId": "660e8400-e29b-41d4-a716-446655440001",
      "status": "PROCESSING",
      "createdAt": "2025-11-22T09:30:00Z",
      "progress": 65
    }
  ],
  "count": 2,
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

### GET /api/deformations

Get displacement measurements from completed InSAR jobs.

**Authentication**: Required

**Query Parameters**:
- `infrastructureId` (string, required): Infrastructure ID
- `pointId` (string, optional): Filter by specific point
- `jobId` (string, optional): Filter by specific job
- `dateFrom` (string, optional): ISO date (e.g., 2025-01-01)
- `dateTo` (string, optional): ISO date
- `minCoherence` (number, optional): Minimum coherence threshold (0-1)
- `limit` (number, optional): Max results (default: 1000)

**Response** (200 OK):
```json
{
  "deformations": [
    {
      "id": "deform-123",
      "pointId": "point-456",
      "jobId": "550e8400-e29b-41d4-a716-446655440000",
      "date": "2025-11-22",
      "losDisplacementMm": -12.5,
      "verticalDisplacementMm": -17.7,
      "coherence": 0.85,
      "quality": "high",
      "temporalBaseline": 12
    },
    {
      "id": "deform-124",
      "pointId": "point-456",
      "jobId": "660e8400-e29b-41d4-a716-446655440001",
      "date": "2025-11-09",
      "losDisplacementMm": -8.3,
      "verticalDisplacementMm": -11.7,
      "coherence": 0.72,
      "quality": "medium"
    }
  ],
  "count": 2,
  "statistics": {
    "meanDisplacement": -10.4,
    "stdDevDisplacement": 2.1,
    "minDisplacement": -12.5,
    "maxDisplacement": -8.3,
    "pointsWithData": 2500,
    "pointsNoData": 100
  }
}
```

---

### GET /api/deformations/time-series/:pointId

Get deformation time series for a specific point.

**Authentication**: Required

**Path Parameters**:
- `pointId` (string, required): Point ID

**Query Parameters**:
- `infrastructureId` (string, required): Infrastructure ID
- `smooth` (boolean, optional): Apply smoothing filter
- `includeVelocity` (boolean, optional): Include velocity estimates

**Response** (200 OK):
```json
{
  "pointId": "point-456",
  "latitude": 37.5234,
  "longitude": -120.4567,
  "timeSeries": [
    {
      "date": "2025-11-22",
      "losDisplacementMm": -12.5,
      "coherence": 0.85,
      "temporalBaseline": 12
    },
    {
      "date": "2025-11-09",
      "losDisplacementMm": -8.3,
      "coherence": 0.72,
      "temporalBaseline": 0
    }
  ],
  "statistics": {
    "meanDisplacement": -10.4,
    "trendMmPerYear": -25.3,
    "dataPoints": 2,
    "timeSpanDays": 12
  },
  "velocity": {
    "displacementMmPerYear": -25.3,
    "confidence": 0.65,
    "r2": 0.92
  }
}
```

---

## Status Lifecycle

```
PENDING
  ↓ (job enqueued)
PROCESSING
  ├→ (successfully completed) → SUCCEEDED
  └→ (error occurred) → FAILED
```

**Status Details**:

| Status | Meaning | Transitional |
|--------|---------|--------------|
| PENDING | Job queued, awaiting processing | Yes |
| PROCESSING | Currently running GMTSAR pipeline | Yes |
| SUCCEEDED | Job completed successfully | No |
| FAILED | Job failed after max retries | No |

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Error details by field"
  },
  "timestamp": "2025-11-22T10:30:00Z"
}
```

**Common Error Codes**:

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| VALIDATION_ERROR | Invalid input | 400 |
| NOT_FOUND | Resource not found | 404 |
| UNAUTHORIZED | Authentication failed | 401 |
| FORBIDDEN | Permission denied | 403 |
| CONFLICT | Resource conflict (e.g., duplicate job) | 409 |
| INTERNAL_ERROR | Server error | 500 |
| GMTSAR_UNAVAILABLE | GMTSAR service not available | 503 |

---

## Rate Limiting

- **Default**: 100 requests per minute per API key
- **Job creation**: 10 jobs per minute
- **Processing**: 5 concurrent GMTSAR jobs maximum

Exceeded limits return `429 Too Many Requests`.

---

## Pagination

List endpoints support cursor-based pagination:

```bash
# Get first page
curl "http://localhost:3000/api/jobs?infrastructureId=...&limit=20"

# Get next page
curl "http://localhost:3000/api/jobs?infrastructureId=...&limit=20&offset=20"
```

---

## Webhooks (Future)

Job status webhooks can be configured for automatic notifications:

```json
POST /api/webhooks

{
  "event": "job.completed",
  "url": "https://yourapp.com/webhook/insar",
  "secret": "webhook_secret_key"
}
```

Events: `job.created`, `job.started`, `job.completed`, `job.failed`

---

Last updated: November 2025
