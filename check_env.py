import sys
try:
    import isce3
    print(f"ISCE3 Version: {isce3.__version__}")
except ImportError as e:
    print(f"ISCE3 Import Failed: {e}")
    sys.exit(1)

try:
    import torch
    print(f"PyTorch Version: {torch.__version__}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA Device: {torch.cuda.get_device_name(0)}")
except ImportError:
    print("PyTorch not installed")
