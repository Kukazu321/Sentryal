/**
 * StreetSAR Types Validation
 * 
 * Simple validation script to test our TypeScript types without Jest dependencies.
 * This validates that our type system is working correctly.
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

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateEnums(): boolean {
  console.log('🔍 Testing Enums...');
  
  // Test StreetSARMode
  const modes = [
    StreetSARMode.SATELLITE,
    StreetSARMode.RADAR,
    StreetSARMode.STREET,
    StreetSARMode.FUSION
  ];
  
  if (modes.length !== 4) {
    console.error('❌ StreetSARMode enum incomplete');
    return false;
  }
  
  // Test StreetViewQuality
  const qualities = [
    StreetViewQuality.LOW,
    StreetViewQuality.MEDIUM,
    StreetViewQuality.HIGH,
    StreetViewQuality.ULTRA
  ];
  
  if (qualities.some(q => typeof q !== 'number')) {
    console.error('❌ StreetViewQuality enum values should be numbers');
    return false;
  }
  
  console.log('✅ Enums validation passed');
  return true;
}

function validateTypeConstruction(): boolean {
  console.log('🔍 Testing Type Construction...');
  
  try {
    // Test GeoCoordinate
    const coord: GeoCoordinate = {
      lng: -122.4194,
      lat: 37.7749,
      elevation: 100
    };
    
    // Test BoundingBox
    const bbox: BoundingBox = {
      sw: [-122.5, 37.7],
      ne: [-122.3, 37.8]
    };
    
    // Test DeformationPoint3D
    const point: DeformationPoint3D = {
      x: -122.4194,
      y: 37.7749,
      z: 100,
      deformation: [1.5, -0.8, 2.3],
      confidence: 0.95,
      timestamp: new Date('2025-11-12T10:00:00Z')
    };
    
    // Test StreetViewPanorama
    const panorama: StreetViewPanorama = {
      panoId: 'test-pano-123',
      location: coord,
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
      copyright: 'Test Copyright'
    };
    
    console.log('✅ Type construction validation passed');
    return true;
    
  } catch (error) {
    console.error('❌ Type construction failed:', error);
    return false;
  }
}

function validateTypeGuards(): boolean {
  console.log('🔍 Testing Type Guards...');
  
  // Test isStreetViewPanorama - valid object
  const validPanorama = {
    panoId: 'test-pano-123',
    location: { lng: -122.4194, lat: 37.7749 },
    captureDate: new Date(),
    imageUrls: {},
    heading: 180,
    pitch: 0,
    fov: 90,
    copyright: 'Google'
  };
  
  if (!isStreetViewPanorama(validPanorama)) {
    console.error('❌ isStreetViewPanorama should return true for valid object');
    return false;
  }
  
  // Test isStreetViewPanorama - invalid object
  const invalidPanorama = {
    id: 'wrong-field',
    location: 'not-an-object'
  };
  
  if (isStreetViewPanorama(invalidPanorama)) {
    console.error('❌ isStreetViewPanorama should return false for invalid object');
    return false;
  }
  
  // Test isFusionAsset - valid object
  const validAsset = {
    id: 'fusion-123',
    insarData: {},
    streetViewData: {},
    registrationQuality: 0.95
  };
  
  if (!isFusionAsset(validAsset)) {
    console.error('❌ isFusionAsset should return true for valid object');
    return false;
  }
  
  // Test isAPIError - valid error
  const validError = {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input'
  };
  
  if (!isAPIError(validError)) {
    console.error('❌ isAPIError should return true for valid error');
    return false;
  }
  
  console.log('✅ Type guards validation passed');
  return true;
}

function validateConstants(): boolean {
  console.log('🔍 Testing Constants...');
  
  // Test DEFAULT_STREETSAR_CONFIG
  if (!DEFAULT_STREETSAR_CONFIG.mode) {
    console.error('❌ DEFAULT_STREETSAR_CONFIG.mode is missing');
    return false;
  }
  
  if (!DEFAULT_STREETSAR_CONFIG.googleApis) {
    console.error('❌ DEFAULT_STREETSAR_CONFIG.googleApis is missing');
    return false;
  }
  
  // Test API_ENDPOINTS
  const requiredEndpoints = ['FUSION_JOBS', 'STREET_VIEW', 'INSAR_DATA', 'ASSETS'];
  for (const endpoint of requiredEndpoints) {
    if (!API_ENDPOINTS[endpoint as keyof typeof API_ENDPOINTS]) {
      console.error(`❌ API_ENDPOINTS.${endpoint} is missing`);
      return false;
    }
  }
  
  // Test ERROR_CODES
  const requiredErrorCodes = [
    'INVALID_COORDINATES',
    'API_QUOTA_EXCEEDED', 
    'FUSION_FAILED',
    'INSUFFICIENT_DATA',
    'PROCESSING_TIMEOUT'
  ];
  
  for (const errorCode of requiredErrorCodes) {
    if (!ERROR_CODES[errorCode as keyof typeof ERROR_CODES]) {
      console.error(`❌ ERROR_CODES.${errorCode} is missing`);
      return false;
    }
  }
  
  console.log('✅ Constants validation passed');
  return true;
}

function validateCompleteConfig(): boolean {
  console.log('🔍 Testing Complete Configuration...');
  
  try {
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
    
    // Validate config structure
    if (config.mode !== StreetSARMode.FUSION) {
      console.error('❌ Config mode validation failed');
      return false;
    }
    
    if (!config.googleApis.streetViewApiKey) {
      console.error('❌ Config streetViewApiKey validation failed');
      return false;
    }
    
    console.log('✅ Complete configuration validation passed');
    return true;
    
  } catch (error) {
    console.error('❌ Complete configuration validation failed:', error);
    return false;
  }
}

function measurePerformance(): boolean {
  console.log('🔍 Testing Performance...');
  
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
  
  // Test type guard performance
  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    isStreetViewPanorama(testObject);
  }
  const end = performance.now();
  
  const duration = end - start;
  console.log(`⏱️ 10k type guard calls took ${duration.toFixed(2)}ms`);
  
  if (duration > 100) {
    console.warn('⚠️ Type guard performance is slower than expected');
    return false;
  }
  
  // Test enum access performance
  const enumStart = performance.now();
  for (let i = 0; i < 100000; i++) {
    const mode = StreetSARMode.FUSION;
    const quality = StreetViewQuality.HIGH;
  }
  const enumEnd = performance.now();
  
  const enumDuration = enumEnd - enumStart;
  console.log(`⏱️ 100k enum accesses took ${enumDuration.toFixed(2)}ms`);
  
  if (enumDuration > 10) {
    console.warn('⚠️ Enum access performance is slower than expected');
    return false;
  }
  
  console.log('✅ Performance validation passed');
  return true;
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

function runAllValidations(): boolean {
  console.log('🚀 Starting StreetSAR Types Validation...\n');
  
  const validations = [
    validateEnums,
    validateTypeConstruction,
    validateTypeGuards,
    validateConstants,
    validateCompleteConfig,
    measurePerformance
  ];
  
  let allPassed = true;
  
  for (const validation of validations) {
    try {
      const result = validation();
      if (!result) {
        allPassed = false;
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      allPassed = false;
    }
    console.log(''); // Empty line for readability
  }
  
  if (allPassed) {
    console.log('🎉 ALL VALIDATIONS PASSED! StreetSAR types are PERFECT! 🎉');
    console.log('🔥 Foundation is TITANESQUE and ready for Phase 2! 🔥');
  } else {
    console.log('💥 Some validations failed. Check the errors above.');
  }
  
  return allPassed;
}

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

export {
  validateEnums,
  validateTypeConstruction,
  validateTypeGuards,
  validateConstants,
  validateCompleteConfig,
  measurePerformance,
  runAllValidations
};

// Auto-run if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runAllValidations();
}
