"""
StreetSAR Custom Exceptions

Ultra-precise exception hierarchy for bulletproof error handling.
Production-ready exception classes with detailed error context.

Author: Sentryal Team  
Version: 1.0.0
"""

from typing import Dict, Any, Optional
from .types import ERROR_CODES


class StreetSARException(Exception):
    """Base exception for all StreetSAR operations"""
    
    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}
        self.request_id = request_id
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
            "request_id": self.request_id
        }


class ValidationError(StreetSARException):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, field: str, value: Any, **kwargs):
        super().__init__(
            message,
            code="VALIDATION_ERROR",
            details={"field": field, "value": value},
            **kwargs
        )


class CoordinateError(ValidationError):
    """Raised when geographic coordinates are invalid"""
    
    def __init__(self, lng: float, lat: float, **kwargs):
        super().__init__(
            f"Invalid coordinates: longitude={lng}, latitude={lat}",
            field="coordinates",
            value={"lng": lng, "lat": lat},
            **kwargs
        )
        self.code = ERROR_CODES["INVALID_COORDINATES"]


class APIQuotaExceededError(StreetSARException):
    """Raised when API quota limits are exceeded"""
    
    def __init__(
        self,
        api_name: str,
        current_usage: int,
        quota_limit: int,
        **kwargs
    ):
        super().__init__(
            f"API quota exceeded for {api_name}: {current_usage}/{quota_limit}",
            code=ERROR_CODES["API_QUOTA_EXCEEDED"],
            details={
                "api_name": api_name,
                "current_usage": current_usage,
                "quota_limit": quota_limit
            },
            **kwargs
        )


class FusionProcessingError(StreetSARException):
    """Raised when fusion processing fails"""
    
    def __init__(
        self,
        job_id: str,
        stage: str,
        reason: str,
        **kwargs
    ):
        super().__init__(
            f"Fusion processing failed for job {job_id} at stage '{stage}': {reason}",
            code=ERROR_CODES["FUSION_FAILED"],
            details={
                "job_id": job_id,
                "stage": stage,
                "reason": reason
            },
            **kwargs
        )


class InsufficientDataError(StreetSARException):
    """Raised when insufficient data is available for processing"""
    
    def __init__(
        self,
        data_type: str,
        required_count: int,
        available_count: int,
        **kwargs
    ):
        super().__init__(
            f"Insufficient {data_type} data: need {required_count}, got {available_count}",
            code=ERROR_CODES["INSUFFICIENT_DATA"],
            details={
                "data_type": data_type,
                "required_count": required_count,
                "available_count": available_count
            },
            **kwargs
        )


class ProcessingTimeoutError(StreetSARException):
    """Raised when processing operations timeout"""
    
    def __init__(
        self,
        operation: str,
        timeout_seconds: float,
        **kwargs
    ):
        super().__init__(
            f"Operation '{operation}' timed out after {timeout_seconds} seconds",
            code=ERROR_CODES["PROCESSING_TIMEOUT"],
            details={
                "operation": operation,
                "timeout_seconds": timeout_seconds
            },
            **kwargs
        )


class StreetViewAPIError(StreetSARException):
    """Raised when Street View API operations fail"""
    
    def __init__(
        self,
        api_response_code: int,
        api_message: str,
        pano_id: Optional[str] = None,
        **kwargs
    ):
        super().__init__(
            f"Street View API error ({api_response_code}): {api_message}",
            code="STREET_VIEW_API_ERROR",
            details={
                "api_response_code": api_response_code,
                "api_message": api_message,
                "pano_id": pano_id
            },
            **kwargs
        )


class InSARProcessingError(StreetSARException):
    """Raised when InSAR processing operations fail"""
    
    def __init__(
        self,
        interferogram_id: str,
        processing_stage: str,
        error_details: str,
        **kwargs
    ):
        super().__init__(
            f"InSAR processing failed for {interferogram_id} at {processing_stage}: {error_details}",
            code="INSAR_PROCESSING_ERROR",
            details={
                "interferogram_id": interferogram_id,
                "processing_stage": processing_stage,
                "error_details": error_details
            },
            **kwargs
        )


class CoRegistrationError(StreetSARException):
    """Raised when co-registration between InSAR and Street View fails"""
    
    def __init__(
        self,
        insar_id: str,
        street_view_id: str,
        registration_quality: float,
        min_quality_threshold: float,
        **kwargs
    ):
        super().__init__(
            f"Co-registration failed: quality {registration_quality} < threshold {min_quality_threshold}",
            code="CO_REGISTRATION_ERROR",
            details={
                "insar_id": insar_id,
                "street_view_id": street_view_id,
                "registration_quality": registration_quality,
                "min_quality_threshold": min_quality_threshold
            },
            **kwargs
        )


class DatabaseError(StreetSARException):
    """Raised when database operations fail"""
    
    def __init__(
        self,
        operation: str,
        table: str,
        error_message: str,
        **kwargs
    ):
        super().__init__(
            f"Database {operation} failed on table '{table}': {error_message}",
            code="DATABASE_ERROR",
            details={
                "operation": operation,
                "table": table,
                "error_message": error_message
            },
            **kwargs
        )


class ConfigurationError(StreetSARException):
    """Raised when configuration is invalid or missing"""
    
    def __init__(
        self,
        config_key: str,
        expected_type: str,
        actual_value: Any,
        **kwargs
    ):
        super().__init__(
            f"Invalid configuration for '{config_key}': expected {expected_type}, got {type(actual_value).__name__}",
            code="CONFIGURATION_ERROR",
            details={
                "config_key": config_key,
                "expected_type": expected_type,
                "actual_value": actual_value
            },
            **kwargs
        )
