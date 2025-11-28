/**
 * StreetSAR Types Test Suite
 * 
 * Comprehensive testing of TypeScript type definitions and runtime validation.
 * Ensures type safety and correctness of the StreetSAR foundation.
 * 
 * @author Sentryal Team
 * @version 1.0.0
 */

import {
  // Enums
  StreetSARMode,
  StreetViewQuality,
  DeformationConfidence,
  FusionStatus,
  
  // Types
  GeoCoordinate,
  BoundingBox,
  DeformationPoint3D,
  StreetViewPanorama,
  FusionAsset,
  StreetSARConfig,
  
  // Type Guards
  isStreetViewPanorama,
  isFusionAsset,
  isAPIError,
  
  // Constants
  DEFAULT_STREETSAR_CONFIG,
  API_ENDPOINTS,
  ERROR_CODES
} from '../types/streetsar';

describe('StreetSAR Types Test Suite', () => {
  
  // ============================================================================
  // ENUM TESTS
  // ============================================================================
  
  describe('Enums', () => {
    test('StreetSARMode enum values', () => {
      expect(StreetSARMode.SATELLITE).toBe('satellite');
      expect(StreetSARMode.RADAR).toBe('radar');
      expect(StreetSARMode.STREET).toBe('street');
      expect(StreetSARMode.FUSION).toBe('fusion');
    });
    
    test('StreetViewQuality enum values', () => {
      expect(StreetViewQuality.LOW).toBe(512);
      expect(StreetViewQuality.MEDIUM).toBe(1024);
      expect(StreetViewQuality.HIGH).toBe(2048);
      expect(StreetViewQuality.ULTRA).toBe(4096);
    });
    
    test('DeformationConfidence enum values', () => {
      expect(DeformationConfidence.LOW).toBe(0.5);
      expect(DeformationConfidence.MEDIUM).toBe(0.75);
      expect(DeformationConfidence.HIGH).toBe(0.9);
      expect(DeformationConfidence.ULTRA).toBe(0.95);
    });
    
    test('FusionStatus enum values', () => {
      expect(FusionStatus.PENDING).toBe('pending');
      expect(FusionStatus.PROCESSING).toBe('processing');
      expect(FusionStatus.COMPLETED).toBe('completed');
      expect(FusionStatus.FAILED).toBe('failed');
      expect(FusionStatus.CANCELLED).toBe('cancelled');
    });
  });
  
  // ============================================================================
  // TYPE CONSTRUCTION TESTS
  // ============================================================================
  
  describe('Type Construction', () => {
    test('GeoCoordinate creation', () => {
      const coord: GeoCoordinate = {
        lng: -122.4194,
        lat: 37.7749,
        elevation: 100
      };
      
      expect(coord.lng).toBe(-122.4194);
      expect(coord.lat).toBe(37.7749);
      expect(coord.elevation).toBe(100);
    });
    
    test('BoundingBox creation', () => {
      const bbox: BoundingBox = {
        sw: [-122.5, 37.7],
        ne: [-122.3, 37.8]
      };
      
      expect(bbox.sw).toEqual([-122.5, 37.7]);
      expect(bbox.ne).toEqual([-122.3, 37.8]);
    });
    
    test('DeformationPoint3D creation', () => {
      const point: DeformationPoint3D = {
        x: -122.4194,
        y: 37.7749,
        z: 100,
        deformation: [1.5, -0.8, 2.3],
        confidence: 0.95,
        timestamp: new Date('2025-11-12T10:00:00Z')
      };
      
      expect(point.deformation).toHaveLength(3);
      expect(point.confidence).toBe(0.95);
      expect(point.timestamp).toBeInstanceOf(Date);
    });
  });
  
  // ============================================================================
  // TYPE GUARD TESTS
  // ============================================================================
  
  describe('Type Guards', () => {
    test('isStreetViewPanorama - valid object', () => {
      const panorama = {
        panoId: 'test-pano-123',
        location: { lng: -122.4194, lat: 37.7749 },
        captureDate: new Date(),
        imageUrls: {},
        heading: 180,
        pitch: 0,
        fov: 90,
        copyright: 'Google'
      };
      
      expect(isStreetViewPanorama(panorama)).toBe(true);
    });
    
    test('isStreetViewPanorama - invalid object', () => {
      const invalid = {
        id: 'wrong-field',
        location: 'not-an-object'
      };
      
      expect(isStreetViewPanorama(invalid)).toBe(false);
    });
    
    test('isFusionAsset - valid object', () => {
      const asset = {
        id: 'fusion-123',
        insarData: {},
        streetViewData: {},
        registrationQuality: 0.95
      };
      
      expect(isFusionAsset(asset)).toBe(true);
    });
    
    test('isAPIError - valid error', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input'
      };
      
      expect(isAPIError(error)).toBe(true);
    });
  });
  
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================
  
  describe('Constants', () => {
    test('DEFAULT_STREETSAR_CONFIG structure', () => {
      expect(DEFAULT_STREETSAR_CONFIG.mode).toBe(StreetSARMode.FUSION);
      expect(DEFAULT_STREETSAR_CONFIG.googleApis).toBeDefined();
      expect(DEFAULT_STREETSAR_CONFIG.insar).toBeDefined();
      expect(DEFAULT_STREETSAR_CONFIG.fusion).toBeDefined();
      expect(DEFAULT_STREETSAR_CONFIG.performance).toBeDefined();
    });
    
    test('API_ENDPOINTS defined', () => {
      expect(API_ENDPOINTS.FUSION_JOBS).toBe('/api/streetsar/fusion-jobs');
      expect(API_ENDPOINTS.STREET_VIEW).toBe('/api/streetsar/street-view');
      expect(API_ENDPOINTS.INSAR_DATA).toBe('/api/streetsar/insar');
      expect(API_ENDPOINTS.ASSETS).toBe('/api/streetsar/assets');
    });
    
    test('ERROR_CODES defined', () => {
      expect(ERROR_CODES.INVALID_COORDINATES).toBe('INVALID_COORDINATES');
      expect(ERROR_CODES.API_QUOTA_EXCEEDED).toBe('API_QUOTA_EXCEEDED');
      expect(ERROR_CODES.FUSION_FAILED).toBe('FUSION_FAILED');
      expect(ERROR_CODES.INSUFFICIENT_DATA).toBe('INSUFFICIENT_DATA');
      expect(ERROR_CODES.PROCESSING_TIMEOUT).toBe('PROCESSING_TIMEOUT');
    });
  });
  
  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  
  describe('Integration Tests', () => {
    test('Complete StreetSARConfig creation', () => {
      const config: StreetSARConfig = {
        mode: StreetSARMode.FUSION,
        googleApis: {
          streetViewApiKey: 'test-key-123',
          geocodingApiKey: 'test-key-456',
          quotaLimits: {
            streetView: 10000,
            geocoding: 10000
          }
        },
        insar: {
          defaultCoherence: 0.85,
          maxBaseline: 150,
          temporalWindow: 180
        },
        fusion: {
          coRegistration: {
            maxDistance: 20,
            temporalWindow: 180,
            minConfidence: DeformationConfidence.HIGH,
            probabilisticWeighting: true
          },
          qualityThresholds: {
            minRegistrationQuality: 0.9,
            minFusionConfidence: 0.95
          }
        },
        performance: {
          maxConcurrentJobs: 5,
          cacheSize: 1000,
          requestTimeout: 30000
        }
      };
      
      expect(config.mode).toBe(StreetSARMode.FUSION);
      expect(config.googleApis.streetViewApiKey).toBe('test-key-123');
      expect(config.insar.defaultCoherence).toBe(0.85);
      expect(config.fusion.coRegistration.maxDistance).toBe(20);
      expect(config.performance.maxConcurrentJobs).toBe(5);
    });
    
    test('Type compatibility across modules', () => {
      // Test that types work together seamlessly
      const panorama: StreetViewPanorama = {
        panoId: 'test-123',
        location: { lng: -122.4194, lat: 37.7749 },
        captureDate: new Date(),
        imageUrls: {
          [StreetViewQuality.LOW]: 'https://example.com/low.jpg',
          [StreetViewQuality.MEDIUM]: 'https://example.com/medium.jpg',
          [StreetViewQuality.HIGH]: 'https://example.com/high.jpg',
          [StreetViewQuality.ULTRA]: 'https://example.com/ultra.jpg'
        },
        heading: 180,
        pitch: 0,
        fov: 90,
        copyright: 'Test'
      };
      
      expect(panorama.imageUrls[StreetViewQuality.LOW]).toBeDefined();
      expect(panorama.imageUrls[StreetViewQuality.MEDIUM]).toBeDefined();
      expect(panorama.imageUrls[StreetViewQuality.HIGH]).toBeDefined();
      expect(isStreetViewPanorama(panorama)).toBe(true);
    });
  });
  
  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================
  
  describe('Performance Tests', () => {
    test('Type guard performance', () => {
      const testObject = {
        panoId: 'test-123',
        location: { lng: -122.4194, lat: 37.7749 },
        captureDate: new Date(),
        imageUrls: {},
        heading: 180,
        pitch: 0,
        fov: 90,
        copyright: 'Test'
      };
      
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        isStreetViewPanorama(testObject);
      }
      const end = performance.now();
      
      // Should complete 10k type checks in under 100ms
      expect(end - start).toBeLessThan(100);
    });
    
    test('Enum access performance', () => {
      const start = performance.now();
      for (let i = 0; i < 100000; i++) {
        const mode = StreetSARMode.FUSION;
        const quality = StreetViewQuality.HIGH;
      }
      const end = performance.now();
      
      // Should complete 100k enum accesses in under 10ms
      expect(end - start).toBeLessThan(10);
    });
  });
});

// ============================================================================
// EXPORT TEST UTILITIES
// ============================================================================

export const createMockPanorama = (overrides: Partial<StreetViewPanorama> = {}): StreetViewPanorama => ({
  panoId: 'mock-pano-123',
  location: { lng: -122.4194, lat: 37.7749 },
  captureDate: new Date('2025-11-12T10:00:00Z'),
  imageUrls: {
    [StreetViewQuality.LOW]: 'https://mock.example.com/low.jpg',
    [StreetViewQuality.MEDIUM]: 'https://mock.example.com/medium.jpg',
    [StreetViewQuality.HIGH]: 'https://mock.example.com/high.jpg',
    [StreetViewQuality.ULTRA]: 'https://mock.example.com/ultra.jpg'
  },
  heading: 180,
  pitch: 0,
  fov: 90,
  copyright: 'Mock Copyright',
  ...overrides
});

export const createMockDeformationPoint = (overrides: Partial<DeformationPoint3D> = {}): DeformationPoint3D => ({
  x: -122.4194,
  y: 37.7749,
  z: 100,
  deformation: [1.5, -0.8, 2.3],
  confidence: 0.95,
  timestamp: new Date('2025-11-12T10:00:00Z'),
  ...overrides
});

export const createMockConfig = (overrides: Partial<StreetSARConfig> = {}): StreetSARConfig => ({
  ...DEFAULT_STREETSAR_CONFIG,
  googleApis: {
    streetViewApiKey: 'mock-street-view-key',
    geocodingApiKey: 'mock-geocoding-key',
    quotaLimits: {
      streetView: 10000,
      geocoding: 10000
    }
  },
  ...overrides
});
