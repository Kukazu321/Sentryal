"""
StreetSAR Backend Module

Revolutionary InSAR + Street View fusion backend for Sentryal platform.
Ultra-scalable, production-ready Python module with zero-compromise architecture.

Author: Sentryal Team
Version: 1.0.0
Since: 2025-11-12
"""

__version__ = "1.0.0"
__author__ = "Sentryal Team"
__email__ = "dev@sentryal.com"

# Module exports
from .config import StreetSARConfig, get_config
from .types import *
from .exceptions import *

__all__ = [
    "StreetSARConfig",
    "get_config",
    # Types will be imported from types module
    # Exceptions will be imported from exceptions module
]
