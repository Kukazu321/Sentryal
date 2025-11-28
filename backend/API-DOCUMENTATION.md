# 📚 API DOCUMENTATION - SENTRYAL BACKEND

## 🔐 Authentication

All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📊 Statistics

### Get Infrastructure Statistics

**GET** `/api/infrastructures/:id/statistics`

Returns comprehensive statistical analysis for an infrastructure.

**Response:**
```json
{
  "infrastructureId": "uuid",
  "infrastructureName": "My Infrastructure",
  "calculatedAt": "2024-11-10T23:00:00Z",
  "statistics": {
    "overview": {
      "totalPoints": 5,
      "activePoints": 5,
      "totalMeasurements": 20,
      "timeSpan": {
        "firstMeasurement": "2024-11-13T00:00:00Z",
        "lastMeasurement": "2024-11-25T00:00:00Z",
        "durationDays": 12
      }
    },
    "displacement": {
      "current": {
        "mean": -17.06,
        "median": -16.52,
        "min": -19.63,
        "max": -15.41,
        "stdDev": 1.52,
        "range": 4.22
      },
      "distribution": {
        "critical": 0,
        "high": 5,
        "medium": 0,
        "low": 0,
        "stable": 0
      }
    },
    "velocity": {
      "mean": -5.2,
      "median": -5.0,
      "accelerating": 2,
      "stable": 3,
      "decelerating": 0
    },
    "spatialAnalysis": {
      "centroid": {
        "latitude": 48.989,
        "longitude": 3.025,
        "displacement_mm": -17.06
      },
      "hotspots": [
        {
          "latitude": 48.988,
          "longitude": 3.024,
          "displacement_mm": -19.63,
          "pointsInRadius": 3
        }
      ]
    },
    "dataQuality": {
      "excellent": 2,
      "good": 2,
      "fair": 1,
      "poor": 0,
      "averageCoherence": 0.95,
      "measurementsPerPoint": {
        "mean": 4,
        "min": 4,
        "max": 4
      }
    },
    "trends": {
      "overall": "worsening",
      "monthlyChange": -1.3,
      "projectedDisplacement30Days": -18.36,
      "projectedDisplacement90Days": -20.96
    },
    "alerts": {
      "criticalPoints": 0,
      "warningPoints": 5,
      "recentChanges": []
    }
  }
}
```

**Cache:** 10 minutes

---

## 📥 Data Export

### Export Deformations

**GET** `/api/deformations/export`

Export deformation data in multiple formats.

**Query Parameters:**
- `infrastructureId` (required): Infrastructure UUID
- `format` (required): `csv` | `geojson` | `json`
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `pointIds` (optional): Comma-separated point IDs
- `includeMetadata` (optional): Include metadata (`true` | `false`)

**Example:**
```
GET /api/deformations/export?infrastructureId=uuid&format=csv&startDate=2024-11-01
```

**Response (CSV):**
```csv
Deformation ID,Point ID,Job ID,Date,Latitude,Longitude,Displacement (mm),Velocity (mm/year),Coherence,Created At
uuid,uuid,uuid,2024-11-25,48.988140,3.024792,-16.52,-5.2,0.98,2024-11-10T19:12:06Z
```

**Response (GeoJSON):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [3.024792, 48.988140]
      },
      "properties": {
        "pointId": "uuid",
        "measurementCount": 4,
        "latestDisplacement": -16.52,
        "latestVelocity": -5.2,
        "measurements": [
          {
            "date": "2024-11-25",
            "displacement_mm": -16.52,
            "velocity_mm_year": -5.2,
            "coherence": 0.98
          }
        ]
      }
    }
  ],
  "metadata": {
    "infrastructureId": "uuid",
    "exportDate": "2024-11-10T23:00:00Z",
    "totalPoints": 5,
    "totalMeasurements": 20
  }
}
```

**Response Headers:**
- `Content-Type`: `text/csv` | `application/geo+json` | `application/json`
- `Content-Disposition`: `attachment; filename="deformations_uuid_2024-11-10.csv"`

---

## 🔄 Job Schedules

### Create Schedule

**POST** `/api/schedules`

Create a recurring job schedule.

**Request Body:**
```json
{
  "infrastructureId": "uuid",
  "name": "Monthly monitoring",
  "frequencyDays": 12,
  "options": {
    "looks": "20x4",
    "includeDEM": true,
    "includeIncMap": false,
    "includeLosDisplacement": true
  }
}
```

**Response:**
```json
{
  "message": "Schedule created successfully",
  "schedule": {
    "id": "uuid",
    "infrastructure_id": "uuid",
    "user_id": "uuid",
    "name": "Monthly monitoring",
    "frequency_days": 12,
    "is_active": true,
    "next_run_at": "2024-11-22T23:00:00Z",
    "total_runs": 0,
    "successful_runs": 0,
    "failed_runs": 0,
    "created_at": "2024-11-10T23:00:00Z"
  }
}
```

### Get All Schedules

**GET** `/api/schedules`

Get all schedules for the authenticated user.

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "name": "Monthly monitoring",
      "frequency_days": 12,
      "is_active": true,
      "next_run_at": "2024-11-22T23:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Infrastructure Schedules

**GET** `/api/schedules/infrastructure/:infrastructureId`

Get schedules for a specific infrastructure.

### Get Schedule Details

**GET** `/api/schedules/:id`

Get detailed statistics for a schedule.

**Response:**
```json
{
  "scheduleId": "uuid",
  "name": "Monthly monitoring",
  "isActive": true,
  "totalRuns": 10,
  "successfulRuns": 9,
  "failedRuns": 1,
  "successRate": 90,
  "avgFrequencyDays": 12.5,
  "lastRunAt": "2024-11-10T12:00:00Z",
  "nextRunAt": "2024-11-22T12:00:00Z"
}
```

### Update Schedule

**PATCH** `/api/schedules/:id`

Update schedule properties.

**Request Body:**
```json
{
  "name": "Updated name",
  "frequencyDays": 15,
  "isActive": false
}
```

### Delete Schedule

**DELETE** `/api/schedules/:id`

Delete a schedule.

### Pause Schedule

**POST** `/api/schedules/:id/pause`

Pause a schedule (sets `is_active` to `false`).

### Resume Schedule

**POST** `/api/schedules/:id/resume`

Resume a paused schedule (sets `is_active` to `true`).

### Global Statistics

**GET** `/api/schedules/stats/global`

Get global schedule statistics.

**Response:**
```json
{
  "totalSchedules": 5,
  "activeSchedules": 4,
  "inactiveSchedules": 1,
  "totalRuns": 50,
  "successfulRuns": 45,
  "failedRuns": 5,
  "globalSuccessRate": 90,
  "avgFrequencyDays": 12.5
}
```

---

## 📍 InSAR Jobs

### Create InSAR Processing Job

**POST** `/api/jobs/process-insar`

Creates a new InSAR processing job for an infrastructure.

**Rate Limits:**
- 5 jobs per hour
- 20 jobs per day
- Max 3 active jobs simultaneously

**Request Body:**
```json
{
  "infrastructureId": "uuid",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "options": {
    "looks": "20x4",
    "includeDEM": true,
    "includeIncMap": false,
    "includeLosDisplacement": true
  }
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "PENDING",
  "hyp3JobId": "uuid",
  "estimatedCompletionTime": "2024-11-10T18:16:00Z"
}
```

**Status Codes:**
- `201` - Job created successfully
- `400` - Invalid request (no points, invalid date range)
- `401` - Unauthorized
- `404` - Infrastructure not found
- `429` - Rate limit exceeded

---

### Get Jobs for Infrastructure

**GET** `/api/jobs?infrastructureId=<uuid>`

Returns all jobs for a specific infrastructure.

**Response:**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "status": "SUCCEEDED",
      "hyp3JobId": "uuid",
      "createdAt": "2024-11-10T17:36:00Z",
      "completedAt": "2024-11-10T18:18:00Z"
    }
  ],
  "count": 1
}
```

---

### Get Job Details

**GET** `/api/jobs/:id`

Returns detailed information about a specific job.

**Response:**
```json
{
  "id": "uuid",
  "status": "SUCCEEDED",
  "hyp3JobId": "uuid",
  "infrastructureId": "uuid",
  "createdAt": "2024-11-10T17:36:00Z",
  "completedAt": "2024-11-10T18:18:00Z",
  "productUrls": [...]
}
```

---

### Retry Failed Job

**POST** `/api/jobs/:id/retry`

Retries a failed or stuck job by re-adding it to the processing queue.

**Response:**
```json
{
  "message": "Job re-queued successfully",
  "jobId": "uuid"
}
```

---

## 📊 Deformations

### Get Deformations for Infrastructure

**GET** `/api/deformations?infrastructureId=<uuid>`

Returns deformation statistics for an infrastructure.

**Query Parameters:**
- `infrastructureId` (required) - UUID of the infrastructure
- `startDate` (optional) - Filter by start date (YYYY-MM-DD)
- `endDate` (optional) - Filter by end date (YYYY-MM-DD)
- `pointId` (optional) - Get time series for specific point

**Response (Statistics):**
```json
{
  "infrastructureId": "uuid",
  "statistics": {
    "totalPoints": 5,
    "totalDeformations": 25,
    "averageDisplacement": -17.05,
    "minDisplacement": -19.63,
    "maxDisplacement": -15.41,
    "dateRange": {
      "start": "2024-11-25",
      "end": "2024-11-25"
    }
  }
}
```

**Response (Time Series for Point):**
```json
{
  "infrastructureId": "uuid",
  "pointId": "uuid",
  "timeSeries": [
    {
      "date": "2024-11-25",
      "displacement_mm": -16.52,
      "coherence": 1.0,
      "velocity_mm_year": null
    }
  ],
  "count": 1
}
```

---

### Get Time Series for Point

**GET** `/api/deformations/time-series/:pointId`

Returns the complete time series of deformations for a specific point.

**Response:**
```json
{
  "pointId": "uuid",
  "timeSeries": [
    {
      "date": "2024-11-13",
      "displacement_mm": -16.52,
      "coherence": 1.0,
      "velocity_mm_year": null
    },
    {
      "date": "2024-11-25",
      "displacement_mm": -17.23,
      "coherence": 0.98,
      "velocity_mm_year": -5.2
    }
  ],
  "count": 2
}
```

---

## 🏗️ Infrastructures

### Get User Infrastructures

**GET** `/api/infrastructures`

Returns all infrastructures for the authenticated user.

**Response:**
```json
{
  "infrastructures": [
    {
      "id": "uuid",
      "name": "Test Zone GeoTIFF",
      "createdAt": "2024-11-09T22:04:40Z",
      "pointsCount": 5
    }
  ],
  "count": 1
}
```

---

### Create Infrastructure

**POST** `/api/infrastructures`

Creates a new infrastructure with a bounding box.

**Request Body:**
```json
{
  "name": "My Infrastructure",
  "bbox": {
    "minLat": 48.85,
    "maxLat": 48.86,
    "minLon": 2.34,
    "maxLon": 2.35
  }
}
```

---

## 📍 Points

### Get Points for Infrastructure

**GET** `/api/points?infrastructureId=<uuid>`

Returns all monitoring points for an infrastructure.

**Response:**
```json
{
  "points": [
    {
      "id": "uuid",
      "latitude": 48.988140,
      "longitude": 3.024792,
      "createdAt": "2024-11-09T22:04:40Z"
    }
  ],
  "count": 5
}
```

---

## 🏥 Health Check

### Check API Health

**GET** `/api/health`

Returns the health status of the API.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-10T18:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "worker": "ok"
  }
}
```

---

## 📝 Job Status Flow

```
PENDING → RUNNING → SUCCEEDED
                  ↘ FAILED
```

- **PENDING**: Job submitted to NASA HyP3, waiting to start
- **RUNNING**: NASA is processing the InSAR data
- **SUCCEEDED**: Processing complete, deformations stored in DB
- **FAILED**: Processing failed (NASA error or parsing error)

---

## ⏱️ Typical Processing Time

- **Job Creation**: Instant
- **NASA Processing**: 30-40 minutes
- **Worker Parsing**: 1-2 minutes
- **Total**: ~35-45 minutes

---

## 🚨 Error Codes

- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## 📊 Rate Limits

### InSAR Job Creation
- **5 jobs per hour**
- **20 jobs per day**
- **3 active jobs max** (PENDING or RUNNING)

When rate limit is exceeded, the API returns:
```json
{
  "error": "Rate limit exceeded",
  "message": "Maximum 5 jobs per hour allowed",
  "retryAfter": 3600
}
```

---

## 🔧 Development

### Base URL
- Development: `http://localhost:5000`
- Production: TBD

### Monitoring
Use the monitoring script to track worker status:
```bash
node monitor-worker.js
```

---

## 📞 Support

For issues or questions, contact the development team.
