import { z } from 'zod';

// GeoJSON types
export const GeoJSONPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
});

export const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))), // [[[lng, lat], ...]]
});

// Auth schemas
export const AuthMeResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
});

// Infrastructure schemas
export const OnboardingModeSchema = z.enum(['ADDRESS', 'DRAW', 'SHP']);

export const CreateInfrastructureSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().optional(),
  bbox: GeoJSONPolygonSchema,
  mode_onboarding: OnboardingModeSchema.optional(),
});

export const InfrastructureResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  mode_onboarding: z.enum(['ADDRESS', 'DRAW', 'SHP']).nullable(),
  bbox: z.string().nullable(), // WKT PostGIS
  created_at: z.date(),
  updated_at: z.date(),
});

// Points schemas
export const PointInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const CreatePointsSchema = z.object({
  infrastructureId: z.string().uuid(),
  points: z.array(PointInputSchema).min(1),
});

export const CreatePointsGeoJSONSchema = z.object({
  infrastructureId: z.string().uuid(),
  geojson: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        geometry: GeoJSONPointSchema,
        properties: z.record(z.string(), z.unknown()).optional(),
      })
    ),
  }),
});

export const PointResponseSchema = z.object({
  id: z.string(),
  infrastructure_id: z.string(),
  geom: z.string(), // WKT PostGIS
  soil_type: z.string().nullable(),
  created_at: z.date(),
});

// Jobs schemas
export const JobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']);

export const CreateJobSchema = z.object({
  infrastructureId: z.string().uuid(),
});

export const JobResponseSchema = z.object({
  id: z.string(),
  infrastructure_id: z.string(),
  hy3_job_id: z.string().nullable(),
  status: JobStatusSchema,
  bbox: z.string().nullable(), // WKT PostGIS
  created_at: z.date(),
  completed_at: z.date().nullable(),
});

// Onboarding / Grid Generation schemas
export const GenerateGridDrawSchema = z.object({
  infrastructureId: z.string().uuid(),
  mode: z.literal('DRAW'),
  polygon: GeoJSONPolygonSchema,
});

export const GenerateGridAddressSchema = z.object({
  infrastructureId: z.string().uuid(),
  mode: z.literal('ADDRESS'),
  address: z.string().min(3).max(500),
});

export const GenerateGridShpSchema = z.object({
  infrastructureId: z.string().uuid(),
  mode: z.literal('SHP'),
  // File will be handled by multer, validated separately
});

export const GenerateGridSchema = z.discriminatedUnion('mode', [
  GenerateGridDrawSchema,
  GenerateGridAddressSchema,
  GenerateGridShpSchema,
]);

// Estimation schemas (no infrastructureId required)
export const EstimateGridDrawSchema = z.object({
  mode: z.literal('DRAW'),
  polygon: GeoJSONPolygonSchema,
});

export const EstimateGridAddressSchema = z.object({
  mode: z.literal('ADDRESS'),
  address: z.string().min(3).max(500),
});

export const EstimateGridSchema = z.discriminatedUnion('mode', [
  EstimateGridDrawSchema,
  EstimateGridAddressSchema,
]);

export const GridEstimationResponseSchema = z.object({
  estimatedPoints: z.number(),
  surfaceKm2: z.number(),
  surfaceM2: z.number(),
  monthlyCostEur: z.number(),
  warnings: z.array(z.string()).optional(),
});

export const GridGenerationResponseSchema = z.object({
  infrastructureId: z.string(),
  pointsCreated: z.number(),
  surfaceKm2: z.number(),
  monthlyCostEur: z.number(),
  generationTimeMs: z.number(),
});

