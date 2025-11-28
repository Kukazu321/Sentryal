/**
 * StreetSAR Frontend Module
 * 
 * Revolutionary InSAR + Street View fusion frontend components.
 * Ultra-scalable React components with zero-compromise architecture.
 * 
 * @author Sentryal Team
 * @version 1.0.0
 * @since 2025-11-12
 */

// Core types
export * from '../types/streetsar';

// Hooks (will be implemented in Phase 2)
// export { useStreetSAR } from './hooks/useStreetSAR';
// export { useStreetViewAPI } from './hooks/useStreetViewAPI';
// export { useFusionEngine } from './hooks/useFusionEngine';

// Components (will be implemented in Phase 2)
// export { AetherMap } from './components/AetherMap';
// export { StreetViewViewer } from './components/StreetViewViewer';
// export { FusionControls } from './components/FusionControls';
// export { ImmersiveViewer } from './components/ImmersiveViewer';

// Utils (will be implemented in Phase 2)
// export { streetSARUtils } from './utils/streetSARUtils';
// export { coordinateUtils } from './utils/coordinateUtils';
// export { fusionAlgorithms } from './utils/fusionAlgorithms';

// Constants
export const STREETSAR_VERSION = '1.0.0';
export const STREETSAR_BUILD_DATE = '2025-11-12';

/**
 * StreetSAR module metadata
 */
export const STREETSAR_META = {
  version: STREETSAR_VERSION,
  buildDate: STREETSAR_BUILD_DATE,
  author: 'Sentryal Team',
  description: 'Revolutionary InSAR + Street View fusion platform',
  license: 'Proprietary',
  repository: 'https://github.com/sentryal/streetsar'
} as const;
