/**
 * StreetSAR Core Types
 * 
 * Ultra-scalable TypeScript definitions for the revolutionary
 * InSAR + Street View fusion platform.
 * 
 * @author Sentryal Team
 * @version 1.0.0
 * @since 2025-11-12
 */

// ============================================================================
// CORE ENUMS
// ============================================================================

/**
 * StreetSAR visualization modes
 */
export enum StreetSARMode {
  SATELLITE = 'satellite',
  RADAR = 'radar', 
  STREET = 'street',
  FUSION = 'fusion'
}

/**
 * Street View image quality levels
 */
export enum StreetViewQuality {
  LOW = 512,
  MEDIUM = 1024,
  HIGH = 2048,
  ULTRA = 4096
}

/**
 * Deformation confidence levels
 */
export enum DeformationConfidence {
  LOW = 0.5,
  MEDIUM = 0.75,
  HIGH = 0.9,
  ULTRA = 0.95
}

/**
 * Processing status for fusion jobs
 */
export enum FusionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// ============================================================================
// GEOMETRIC TYPES
// ============================================================================

/**
 * 3D point with deformation vector
 */
export interface DeformationPoint3D {
  /** X coordinate (longitude) */
  x: number;
  /** Y coordinate (latitude) */
  y: number;
  /** Z coordinate (elevation in meters) */
  z: number;
  /** Deformation vector [dx, dy, dz] in mm/year */
  deformation: [number, number, number];
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp of measurement */
  timestamp: Date;
}

/**
 * Bounding box for spatial queries
 */
export interface BoundingBox {
  /** Southwest corner */
  sw: [number, number];
  /** Northeast corner */
  ne: [number, number];
}

/**
 * Geographic coordinate with optional elevation
 */
export interface GeoCoordinate {
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
  /** Elevation in meters (optional) */
  elevation?: number;
}

// ============================================================================
// STREET VIEW TYPES
// ============================================================================

/**
 * Street View panorama metadata
 */
export interface StreetViewPanorama {
  /** Unique panorama ID */
  panoId: string;
  /** Geographic location */
  location: GeoCoordinate;
  /** Capture date */
  captureDate: Date;
  /** Image URLs for different sizes */
  imageUrls: {
    [key in StreetViewQuality]: string;
  };
  /** Camera heading (0-360 degrees) */
  heading: number;
  /** Camera pitch (-90 to 90 degrees) */
  pitch: number;
  /** Field of view (10-100 degrees) */
  fov: number;
  /** Copyright information */
  copyright: string;
}

/**
 * Street View API request parameters
 */
export interface StreetViewRequest {
  /** Target location */
  location: GeoCoordinate;
  /** Image size */
  size: StreetViewQuality;
  /** Camera heading */
  heading?: number;
  /** Camera pitch */
  pitch?: number;
  /** Field of view */
  fov?: number;
  /** Specific panorama ID (optional) */
  panoId?: string;
}

/**
 * Street View batch processing job
 */
export interface StreetViewBatchJob {
  /** Unique job ID */
  id: string;
  /** List of requests to process */
  requests: StreetViewRequest[];
  /** Current processing status */
  status: FusionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Created timestamp */
  createdAt: Date;
  /** Completed timestamp (optional) */
  completedAt?: Date;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// INSAR TYPES
// ============================================================================

/**
 * InSAR acquisition metadata
 */
export interface InSARAcquisition {
  /** Unique acquisition ID */
  id: string;
  /** Satellite mission (e.g., 'Sentinel-1A') */
  mission: string;
  /** Acquisition date */
  date: Date;
  /** Orbit direction */
  orbitDirection: 'ASCENDING' | 'DESCENDING';
  /** Track number */
  track: number;
  /** Baseline perpendicular (meters) */
  baseline: number;
  /** Coherence threshold */
  coherenceThreshold: number;
  /** Processing level */
  processingLevel: string;
}

/**
 * InSAR interferogram result
 */
export interface InSARInterferogram {
  /** Unique interferogram ID */
  id: string;
  /** Reference acquisition */
  reference: InSARAcquisition;
  /** Secondary acquisition */
  secondary: InSARAcquisition;
  /** Temporal baseline (days) */
  temporalBaseline: number;
  /** Spatial baseline (meters) */
  spatialBaseline: number;
  /** Average coherence */
  averageCoherence: number;
  /** Deformation points */
  deformationPoints: DeformationPoint3D[];
  /** Processing timestamp */
  processedAt: Date;
  /** GeoTIFF file URL */
  geoTiffUrl: string;
}

// ============================================================================
// FUSION TYPES
// ============================================================================

/**
 * Co-registration parameters for InSAR-Street View fusion
 */
export interface CoRegistrationParams {
  /** Maximum spatial distance for matching (meters) */
  maxDistance: number;
  /** Temporal window for matching (days) */
  temporalWindow: number;
  /** Minimum confidence threshold */
  minConfidence: DeformationConfidence;
  /** Use probabilistic weighting */
  probabilisticWeighting: boolean;
}

/**
 * Fusion asset combining InSAR and Street View data
 */
export interface FusionAsset {
  /** Unique fusion asset ID */
  id: string;
  /** Associated InSAR interferogram */
  insarData: InSARInterferogram;
  /** Associated Street View panorama */
  streetViewData: StreetViewPanorama;
  /** Co-registration quality score */
  registrationQuality: number;
  /** Fusion confidence */
  fusionConfidence: number;
  /** 3D deformation visualization data */
  deformation3D: DeformationPoint3D[];
  /** Processing metadata */
  metadata: {
    processedAt: Date;
    processingTime: number; // milliseconds
    algorithm: string;
    version: string;
  };
}

/**
 * Fusion processing job
 */
export interface FusionJob {
  /** Unique job ID */
  id: string;
  /** Infrastructure ID this job belongs to */
  infrastructureId: string;
  /** InSAR data to process */
  insarInputs: InSARInterferogram[];
  /** Street View data to process */
  streetViewInputs: StreetViewPanorama[];
  /** Co-registration parameters */
  coRegParams: CoRegistrationParams;
  /** Current status */
  status: FusionStatus;
  /** Progress percentage */
  progress: number;
  /** Result fusion assets */
  results: FusionAsset[];
  /** Created timestamp */
  createdAt: Date;
  /** Started timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    details: Record<string, any>;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
  /** Response data */
  data: T;
  /** Success flag */
  success: boolean;
  /** Response message */
  message: string;
  /** Response timestamp */
  timestamp: Date;
  /** Request metadata */
  meta?: {
    requestId: string;
    processingTime: number;
    version: string;
  };
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  /** Pagination metadata */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Error response structure
 */
export interface APIError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Detailed error information */
  details?: Record<string, any>;
  /** Stack trace (development only) */
  stack?: string;
  /** Request ID for tracking */
  requestId?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * StreetSAR application configuration
 */
export interface StreetSARConfig {
  /** Current visualization mode */
  mode: StreetSARMode;
  /** Google API configuration */
  googleApis: {
    streetViewApiKey: string;
    geocodingApiKey: string;
    quotaLimits: {
      streetView: number;
      geocoding: number;
    };
  };
  /** InSAR processing configuration */
  insar: {
    defaultCoherence: number;
    maxBaseline: number;
    temporalWindow: number;
  };
  /** Fusion algorithm parameters */
  fusion: {
    coRegistration: CoRegistrationParams;
    qualityThresholds: {
      minRegistrationQuality: number;
      minFusionConfidence: number;
    };
  };
  /** Performance settings */
  performance: {
    maxConcurrentJobs: number;
    cacheSize: number;
    requestTimeout: number;
  };
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/**
 * Props for StreetSAR map component
 */
export interface StreetSARMapProps {
  /** Current configuration */
  config: StreetSARConfig;
  /** Fusion assets to display */
  fusionAssets: FusionAsset[];
  /** Selected asset ID */
  selectedAssetId?: string;
  /** Bounding box for initial view */
  initialBounds?: BoundingBox;
  /** Event handlers */
  onAssetSelect?: (assetId: string) => void;
  onModeChange?: (mode: StreetSARMode) => void;
  onBoundsChange?: (bounds: BoundingBox) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: APIError;
}

/**
 * Props for Street View viewer component
 */
export interface StreetViewViewerProps {
  /** Panorama to display */
  panorama: StreetViewPanorama;
  /** Deformation overlays */
  deformationOverlays?: DeformationPoint3D[];
  /** Viewer configuration */
  config: {
    showControls: boolean;
    enableVR: boolean;
    autoRotate: boolean;
  };
  /** Event handlers */
  onPanoramaChange?: (panoId: string) => void;
  onDeformationClick?: (point: DeformationPoint3D) => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for configuration updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Omit multiple keys from type
 */
export type OmitMultiple<T, K extends keyof T> = Omit<T, K>;

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for StreetViewPanorama
 */
export function isStreetViewPanorama(obj: any): obj is StreetViewPanorama {
  return (
    typeof obj === 'object' &&
    typeof obj.panoId === 'string' &&
    typeof obj.location === 'object' &&
    obj.captureDate instanceof Date
  );
}

/**
 * Type guard for FusionAsset
 */
export function isFusionAsset(obj: any): obj is FusionAsset {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.insarData === 'object' &&
    typeof obj.streetViewData === 'object' &&
    typeof obj.registrationQuality === 'number'
  );
}

/**
 * Type guard for APIError
 */
export function isAPIError(obj: any): obj is APIError {
  return (
    typeof obj === 'object' &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string'
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_STREETSAR_CONFIG: StreetSARConfig = {
  mode: StreetSARMode.FUSION,
  googleApis: {
    streetViewApiKey: '',
    geocodingApiKey: '',
    quotaLimits: {
      streetView: 10000,
      geocoding: 10000,
    },
  },
  insar: {
    defaultCoherence: 0.85,
    maxBaseline: 150,
    temporalWindow: 180,
  },
  fusion: {
    coRegistration: {
      maxDistance: 20,
      temporalWindow: 180,
      minConfidence: DeformationConfidence.HIGH,
      probabilisticWeighting: true,
    },
    qualityThresholds: {
      minRegistrationQuality: 0.9,
      minFusionConfidence: 0.95,
    },
  },
  performance: {
    maxConcurrentJobs: 5,
    cacheSize: 1000,
    requestTimeout: 30000,
  },
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  FUSION_JOBS: '/api/streetsar/fusion-jobs',
  STREET_VIEW: '/api/streetsar/street-view',
  INSAR_DATA: '/api/streetsar/insar',
  ASSETS: '/api/streetsar/assets',
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  FUSION_FAILED: 'FUSION_FAILED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
} as const;
