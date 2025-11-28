"""
StreetSAR Backend Types

Ultra-precise Python type definitions for the StreetSAR fusion engine.
Mirrors TypeScript types for perfect frontend-backend synchronization.

Author: Sentryal Team
Version: 1.0.0
"""

from __future__ import annotations
from typing import Dict, List, Optional, Union, Tuple, Any, Literal
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid

# ============================================================================
# CORE ENUMS
# ============================================================================

class StreetSARMode(str, Enum):
    """StreetSAR visualization modes"""
    SATELLITE = "satellite"
    RADAR = "radar"
    STREET = "street"
    FUSION = "fusion"


class StreetViewQuality(int, Enum):
    """Street View image quality levels"""
    LOW = 512
    MEDIUM = 1024
    HIGH = 2048
    ULTRA = 4096


class DeformationConfidence(float, Enum):
    """Deformation confidence levels"""
    LOW = 0.5
    MEDIUM = 0.75
    HIGH = 0.9
    ULTRA = 0.95


class FusionStatus(str, Enum):
    """Processing status for fusion jobs"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OrbitDirection(str, Enum):
    """Satellite orbit direction"""
    ASCENDING = "ASCENDING"
    DESCENDING = "DESCENDING"


# ============================================================================
# GEOMETRIC TYPES
# ============================================================================

@dataclass(frozen=True)
class GeoCoordinate:
    """Geographic coordinate with optional elevation"""
    lng: float
    lat: float
    elevation: Optional[float] = None
    
    def __post_init__(self):
        """Validate coordinate ranges"""
        if not -180 <= self.lng <= 180:
            raise ValueError(f"Invalid longitude: {self.lng}")
        if not -90 <= self.lat <= 90:
            raise ValueError(f"Invalid latitude: {self.lat}")


@dataclass(frozen=True)
class BoundingBox:
    """Bounding box for spatial queries"""
    sw: Tuple[float, float]  # Southwest corner (lng, lat)
    ne: Tuple[float, float]  # Northeast corner (lng, lat)
    
    def __post_init__(self):
        """Validate bounding box"""
        if self.sw[0] >= self.ne[0] or self.sw[1] >= self.ne[1]:
            raise ValueError("Invalid bounding box: SW must be less than NE")


@dataclass
class DeformationPoint3D:
    """3D point with deformation vector"""
    x: float  # Longitude
    y: float  # Latitude
    z: float  # Elevation in meters
    deformation: Tuple[float, float, float]  # [dx, dy, dz] in mm/year
    confidence: float
    timestamp: datetime
    
    def __post_init__(self):
        """Validate deformation point"""
        if not 0 <= self.confidence <= 1:
            raise ValueError(f"Invalid confidence: {self.confidence}")


# ============================================================================
# STREET VIEW TYPES
# ============================================================================

@dataclass
class StreetViewPanorama:
    """Street View panorama metadata"""
    pano_id: str
    location: GeoCoordinate
    capture_date: datetime
    image_urls: Dict[StreetViewQuality, str]
    heading: float  # 0-360 degrees
    pitch: float    # -90 to 90 degrees
    fov: float      # 10-100 degrees
    copyright: str
    
    def __post_init__(self):
        """Validate panorama parameters"""
        if not 0 <= self.heading <= 360:
            raise ValueError(f"Invalid heading: {self.heading}")
        if not -90 <= self.pitch <= 90:
            raise ValueError(f"Invalid pitch: {self.pitch}")
        if not 10 <= self.fov <= 100:
            raise ValueError(f"Invalid FOV: {self.fov}")


@dataclass
class StreetViewRequest:
    """Street View API request parameters"""
    location: GeoCoordinate
    size: StreetViewQuality
    heading: Optional[float] = None
    pitch: Optional[float] = None
    fov: Optional[float] = None
    pano_id: Optional[str] = None


@dataclass
class StreetViewBatchJob:
    """Street View batch processing job"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    requests: List[StreetViewRequest] = field(default_factory=list)
    status: FusionStatus = FusionStatus.PENDING
    progress: float = 0.0  # 0-100
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# ============================================================================
# INSAR TYPES
# ============================================================================

@dataclass
class InSARAcquisition:
    """InSAR acquisition metadata"""
    id: str
    mission: str  # e.g., 'Sentinel-1A'
    date: datetime
    orbit_direction: OrbitDirection
    track: int
    baseline: float  # Baseline perpendicular (meters)
    coherence_threshold: float
    processing_level: str


@dataclass
class InSARInterferogram:
    """InSAR interferogram result"""
    id: str
    reference: InSARAcquisition
    secondary: InSARAcquisition
    temporal_baseline: int  # days
    spatial_baseline: float  # meters
    average_coherence: float
    deformation_points: List[DeformationPoint3D]
    processed_at: datetime
    geotiff_url: str


# ============================================================================
# FUSION TYPES
# ============================================================================

@dataclass
class CoRegistrationParams:
    """Co-registration parameters for InSAR-Street View fusion"""
    max_distance: float = 20.0  # meters
    temporal_window: int = 180  # days
    min_confidence: DeformationConfidence = DeformationConfidence.HIGH
    probabilistic_weighting: bool = True


@dataclass
class FusionMetadata:
    """Fusion processing metadata"""
    processed_at: datetime
    processing_time: float  # milliseconds
    algorithm: str
    version: str


@dataclass
class FusionAsset:
    """Fusion asset combining InSAR and Street View data"""
    insar_data: InSARInterferogram
    street_view_data: StreetViewPanorama
    registration_quality: float  # 0-1
    fusion_confidence: float     # 0-1
    deformation_3d: List[DeformationPoint3D]
    metadata: FusionMetadata
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def __post_init__(self):
        """Validate fusion asset"""
        if not 0 <= self.registration_quality <= 1:
            raise ValueError(f"Invalid registration quality: {self.registration_quality}")
        if not 0 <= self.fusion_confidence <= 1:
            raise ValueError(f"Invalid fusion confidence: {self.fusion_confidence}")


@dataclass
class FusionError:
    """Fusion job error details"""
    code: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FusionJob:
    """Fusion processing job"""
    infrastructure_id: str
    insar_inputs: List[InSARInterferogram]
    street_view_inputs: List[StreetViewPanorama]
    co_reg_params: CoRegistrationParams
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: FusionStatus = FusionStatus.PENDING
    progress: float = 0.0  # 0-100
    results: List[FusionAsset] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[FusionError] = None


# ============================================================================
# API RESPONSE TYPES
# ============================================================================

@dataclass
class APIMetadata:
    """API response metadata"""
    request_id: str
    processing_time: float  # milliseconds
    version: str


@dataclass
class APIResponse:
    """Standard API response wrapper"""
    data: Any
    success: bool
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    meta: Optional[APIMetadata] = None


@dataclass
class PaginationMeta:
    """Pagination metadata"""
    page: int
    limit: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool


@dataclass
class PaginatedResponse:
    """Paginated API response"""
    data: Any
    success: bool
    message: str
    pagination: PaginationMeta
    timestamp: datetime = field(default_factory=datetime.utcnow)
    meta: Optional[APIMetadata] = None


@dataclass
class APIError:
    """Error response structure"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    stack: Optional[str] = None
    request_id: Optional[str] = None


# ============================================================================
# CONFIGURATION TYPES
# ============================================================================

@dataclass
class GoogleAPIConfig:
    """Google API configuration"""
    street_view_api_key: str
    geocoding_api_key: str
    quota_limits: Dict[str, int] = field(default_factory=lambda: {
        "street_view": 10000,
        "geocoding": 10000
    })


@dataclass
class InSARConfig:
    """InSAR processing configuration"""
    default_coherence: float = 0.85
    max_baseline: float = 150.0
    temporal_window: int = 180


@dataclass
class FusionConfig:
    """Fusion algorithm configuration"""
    co_registration: CoRegistrationParams = field(default_factory=CoRegistrationParams)
    quality_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "min_registration_quality": 0.9,
        "min_fusion_confidence": 0.95
    })


@dataclass
class PerformanceConfig:
    """Performance settings"""
    max_concurrent_jobs: int = 5
    cache_size: int = 1000
    request_timeout: float = 30.0  # seconds


@dataclass
class StreetSARConfig:
    """StreetSAR application configuration"""
    google_apis: GoogleAPIConfig
    mode: StreetSARMode = StreetSARMode.FUSION
    insar: InSARConfig = field(default_factory=InSARConfig)
    fusion: FusionConfig = field(default_factory=FusionConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)


# ============================================================================
# CONSTANTS
# ============================================================================

# API endpoints
API_ENDPOINTS = {
    "FUSION_JOBS": "/api/streetsar/fusion-jobs",
    "STREET_VIEW": "/api/streetsar/street-view", 
    "INSAR_DATA": "/api/streetsar/insar",
    "ASSETS": "/api/streetsar/assets",
}

# Error codes
ERROR_CODES = {
    "INVALID_COORDINATES": "INVALID_COORDINATES",
    "API_QUOTA_EXCEEDED": "API_QUOTA_EXCEEDED",
    "FUSION_FAILED": "FUSION_FAILED",
    "INSUFFICIENT_DATA": "INSUFFICIENT_DATA",
    "PROCESSING_TIMEOUT": "PROCESSING_TIMEOUT",
}

# Default values
DEFAULT_STREET_VIEW_QUALITY = StreetViewQuality.HIGH
DEFAULT_DEFORMATION_CONFIDENCE = DeformationConfidence.HIGH
DEFAULT_TEMPORAL_WINDOW = 180  # days
DEFAULT_MAX_DISTANCE = 20.0  # meters
