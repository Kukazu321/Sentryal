/**
 * Esri World Imagery Integration Types
 * 
 * Ultra-precise TypeScript definitions for enterprise-grade
 * Esri basemap integration with performance monitoring,
 * error handling, and scalable architecture.
 * 
 * @version 1.0.0
 * @author Sentryal Engineering Team
 * @performance Optimized for 2M+ tiles/month with <100ms latency
 */

// ============================================================================
// CORE CONFIGURATION TYPES
// ============================================================================

/**
 * Comprehensive Esri basemap configuration
 * Supports multi-environment deployment with performance tuning
 */
export interface EsriBasemapConfig {
  /** API key for Esri Location Platform */
  readonly apiKey: string;
  
  /** Base URL for Esri services - supports multiple endpoints */
  readonly baseUrl: string;
  
  /** Active basemap style variant */
  style: EsriBasemapStyle;
  
  /** Enable automatic fallback to Mapbox on quota/error */
  readonly fallbackEnabled: boolean;
  
  /** Maximum zoom level (performance optimization) */
  readonly maxZoom: number;
  
  /** Tile size for optimal bandwidth usage */
  readonly tileSize: 256 | 512;
  
  /** Attribution string for legal compliance */
  readonly attribution: string;
  
  /** Performance monitoring configuration */
  readonly monitoring: EsriMonitoringConfig;
}

/**
 * Available Esri basemap style variants
 * Each optimized for specific use cases
 */
export type EsriBasemapStyle = 
  | 'standard'    // Balanced quality/performance
  | 'clarity'     // Enhanced sharpness (premium)
  | 'wayback';    // Historical imagery selection

/**
 * Performance monitoring and alerting configuration
 */
export interface EsriMonitoringConfig {
  /** Enable tile usage tracking */
  readonly trackUsage: boolean;
  
  /** Enable performance metrics collection */
  readonly trackPerformance: boolean;
  
  /** Alert thresholds for quota management */
  readonly alertThresholds: {
    readonly warning: number;    // 80%
    readonly critical: number;   // 95%
  };
  
  /** Cache configuration for optimal performance */
  readonly cache: {
    readonly ttl: number;        // Cache TTL in seconds
    readonly maxSize: number;    // Max cache entries
  };
}

// ============================================================================
// TILE USAGE & QUOTA MANAGEMENT
// ============================================================================

/**
 * Real-time tile usage tracking with projections
 * Critical for quota management and cost optimization
 */
export interface EsriTileUsage {
  /** Current tile count this month */
  readonly count: number;
  
  /** Monthly quota limit (2M for free tier) */
  readonly limit: number;
  
  /** Usage percentage (0-100) */
  readonly percentage: number;
  
  /** Next quota reset date */
  readonly resetDate: Date;
  
  /** Usage projections and analytics */
  readonly analytics: EsriUsageAnalytics;
}

/**
 * Advanced usage analytics for predictive scaling
 */
export interface EsriUsageAnalytics {
  /** Daily average tile consumption */
  readonly dailyAverage: number;
  
  /** Projected monthly total */
  readonly projectedMonthly: number;
  
  /** Days until quota reset */
  readonly daysRemaining: number;
  
  /** Recommended actions based on usage patterns */
  readonly recommendations: EsriUsageRecommendation[];
}

/**
 * Automated recommendations for quota optimization
 */
export interface EsriUsageRecommendation {
  readonly type: 'reduce_zoom' | 'enable_cache' | 'upgrade_plan' | 'optimize_viewport';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly estimatedSavings: number; // Percentage
}

// ============================================================================
// BASEMAP SOURCE DEFINITIONS
// ============================================================================

/**
 * Esri basemap source configuration for Mapbox GL integration
 * Optimized for WebGL rendering and tile streaming
 */
export interface EsriBasemapSource {
  /** Unique identifier for the source */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Tile URL template with token injection */
  readonly url: string;
  
  /** Tile size (256 or 512) for bandwidth optimization */
  readonly tileSize: 256 | 512;
  
  /** Maximum zoom level supported */
  readonly maxzoom: number;
  
  /** Minimum zoom level for performance */
  readonly minzoom: number;
  
  /** Attribution string for legal compliance */
  readonly attribution: string;
  
  /** Source-specific metadata */
  readonly metadata: EsriSourceMetadata;
}

/**
 * Extended metadata for basemap sources
 */
export interface EsriSourceMetadata {
  /** Source type classification */
  readonly type: 'satellite' | 'hybrid' | 'terrain';
  
  /** Typical resolution in cm/pixel */
  readonly resolution: number;
  
  /** Update frequency description */
  readonly updateFrequency: string;
  
  /** Coverage areas (global, regional, etc.) */
  readonly coverage: string[];
  
  /** Performance characteristics */
  readonly performance: {
    readonly avgLoadTime: number;    // ms
    readonly reliability: number;    // 0-1
    readonly bandwidth: number;      // KB/tile average
  };
}

// ============================================================================
// ERROR HANDLING & RESILIENCE
// ============================================================================

/**
 * Comprehensive error types for robust error handling
 */
export type EsriErrorType = 
  | 'quota_exceeded'     // Monthly limit reached
  | 'api_key_invalid'    // Authentication failure
  | 'service_unavailable' // Esri service down
  | 'network_error'      // Connectivity issues
  | 'rate_limited'       // Too many requests
  | 'tile_not_found'     // 404 on specific tile
  | 'unknown_error';     // Catch-all

/**
 * Structured error information with recovery suggestions
 */
export interface EsriError {
  readonly type: EsriErrorType;
  readonly message: string;
  readonly code?: number;
  readonly timestamp: Date;
  readonly context: EsriErrorContext;
  readonly recovery: EsriRecoveryAction[];
}

/**
 * Error context for debugging and monitoring
 */
export interface EsriErrorContext {
  readonly url?: string;
  readonly tileCoords?: { x: number; y: number; z: number };
  readonly usage?: Pick<EsriTileUsage, 'count' | 'percentage'>;
  readonly userAgent?: string;
  readonly sessionId?: string;
}

/**
 * Automated recovery actions for resilient operation
 */
export interface EsriRecoveryAction {
  readonly type: 'fallback_mapbox' | 'retry_request' | 'reduce_quality' | 'notify_user';
  readonly priority: number;
  readonly description: string;
  readonly automated: boolean;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Real-time performance metrics for optimization
 */
export interface EsriPerformanceMetrics {
  /** Tile loading performance */
  readonly tileMetrics: {
    readonly avgLoadTime: number;    // ms
    readonly successRate: number;    // 0-1
    readonly errorRate: number;      // 0-1
    readonly cacheHitRate: number;   // 0-1
  };
  
  /** Network performance */
  readonly networkMetrics: {
    readonly bandwidth: number;      // KB/s
    readonly latency: number;        // ms
    readonly jitter: number;         // ms variance
  };
  
  /** User experience metrics */
  readonly uxMetrics: {
    readonly timeToFirstTile: number;  // ms
    readonly mapInteractivity: number; // ms to respond
    readonly visualCompleteness: number; // 0-1
  };
}

// ============================================================================
// WAYBACK IMAGERY SUPPORT
// ============================================================================

/**
 * Wayback imagery vintage selection for historical analysis
 */
export interface EsriWaybackVintage {
  readonly id: string;
  readonly date: Date;
  readonly description: string;
  readonly coverage: string[];
  readonly quality: 'excellent' | 'good' | 'fair' | 'poor';
  readonly url: string;
}

/**
 * Wayback service configuration
 */
export interface EsriWaybackConfig {
  readonly enabled: boolean;
  readonly availableVintages: EsriWaybackVintage[];
  readonly selectedVintage?: string;
  readonly autoSelectBest: boolean;
}

// ============================================================================
// INTEGRATION HOOKS
// ============================================================================

/**
 * React hook return type for Esri basemap integration
 */
export interface UseEsriBasemapReturn {
  /** Current active basemap source */
  readonly currentSource: EsriBasemapSource | null;
  
  /** Whether fallback mode is active */
  readonly isUsingFallback: boolean;
  
  /** Real-time usage statistics */
  readonly usage: EsriTileUsage | null;
  
  /** Current basemap style */
  readonly style: EsriBasemapStyle;
  
  /** Performance metrics */
  readonly performance: EsriPerformanceMetrics | null;
  
  /** Current error state */
  readonly error: EsriError | null;
  
  /** Loading state */
  readonly isLoading: boolean;
  
  // Actions
  readonly changeStyle: (style: EsriBasemapStyle) => Promise<void>;
  readonly trackTileLoad: () => void;
  readonly forceFallback: () => void;
  readonly clearError: () => void;
  readonly refreshUsage: () => Promise<void>;
  
  /** Alert level based on usage */
  readonly usageAlert: 'none' | 'warning' | 'critical';
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Environment-specific configuration
 */
export type EsriEnvironment = 'development' | 'staging' | 'production';

/**
 * Tile coordinate system
 */
export interface TileCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Geographic bounds for optimization
 */
export interface GeographicBounds {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

/**
 * Cache entry for tile management
 */
export interface EsriTileCacheEntry {
  readonly key: string;
  readonly url: string;
  readonly timestamp: Date;
  readonly size: number;
  readonly hits: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Esri service endpoints by environment
 */
export const ESRI_ENDPOINTS = {
  BASEMAPS: 'https://services.arcgisonline.com/arcgis/rest/services',
  CLARITY: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services',
  WAYBACK: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services',
} as const;

/**
 * Default quota limits by tier
 */
export const ESRI_QUOTA_LIMITS = {
  FREE: 2_000_000,      // 2M tiles/month
  BASIC: 10_000_000,    // 10M tiles/month
  STANDARD: 50_000_000, // 50M tiles/month
  PREMIUM: 200_000_000, // 200M tiles/month
} as const;

/**
 * Performance thresholds for monitoring
 */
export const ESRI_PERFORMANCE_THRESHOLDS = {
  TILE_LOAD_TIME: {
    EXCELLENT: 100,  // ms
    GOOD: 300,       // ms
    POOR: 1000,      // ms
  },
  SUCCESS_RATE: {
    EXCELLENT: 0.99, // 99%
    GOOD: 0.95,      // 95%
    POOR: 0.90,      // 90%
  },
} as const;
