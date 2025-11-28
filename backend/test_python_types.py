"""
Simple Python types test without complex imports
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Test basic enums only
from streetsar.types import StreetSARMode, StreetViewQuality, DeformationConfidence, FusionStatus

def test_enums():
    print("🔍 Testing Python Enums...")
    
    # Test StreetSARMode
    assert StreetSARMode.FUSION == "fusion"
    assert StreetSARMode.SATELLITE == "satellite"
    print("✅ StreetSARMode enum works")
    
    # Test StreetViewQuality
    assert StreetViewQuality.HIGH == 2048
    assert StreetViewQuality.LOW == 512
    print("✅ StreetViewQuality enum works")
    
    # Test DeformationConfidence
    assert DeformationConfidence.ULTRA == 0.95
    assert DeformationConfidence.HIGH == 0.9
    print("✅ DeformationConfidence enum works")
    
    # Test FusionStatus
    assert FusionStatus.PENDING == "pending"
    assert FusionStatus.COMPLETED == "completed"
    print("✅ FusionStatus enum works")
    
    print("🎉 All Python enum tests passed!")

if __name__ == "__main__":
    test_enums()
