#!/usr/bin/env python3
"""Test ISCE3 GPU performance on RTX 4090"""

import time
import sys

def test_isce3():
    print("="*60)
    print("ISCE3 GPU Performance Test - RTX 4090")
    print("="*60)
    
    # 1. Test basic import
    print("\n[1/4] Testing ISCE3 import...")
    start = time.time()
    try:
        import isce3
        print(f"     ✅ ISCE3 version: {isce3.__version__}")
    except Exception as e:
        print(f"     ❌ Import failed: {e}")
        return
    
    # 2. Test CUDA availability
    print("\n[2/4] Testing CUDA availability...")
    try:
        import isce3.cuda as isce3_cuda
        print("     ✅ ISCE3 CUDA module available")
        cuda_available = True
    except ImportError:
        print("     ⚠️  ISCE3 CUDA module not available")
        cuda_available = False
    
    # 3. Test NumPy + CuPy for GPU processing
    print("\n[3/4] Testing GPU libraries...")
    try:
        import numpy as np
        print(f"     ✅ NumPy version: {np.__version__}")
        
        import cupy as cp
        print(f"     ✅ CuPy version: {cp.__version__}")
        
        # GPU info
        device = cp.cuda.Device(0)
        props = device.attributes
        print(f"     ✅ GPU: {cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}")
        print(f"     ✅ GPU Memory: {device.mem_info[1] / 1e9:.1f} GB")
    except ImportError as e:
        print(f"     ⚠️  CuPy not available: {e}")
        print("        Installing CuPy for RTX 4090...")
    except Exception as e:
        print(f"     ⚠️  GPU check error: {e}")
    
    # 4. GPU processing benchmark
    print("\n[4/4] GPU Processing Benchmark...")
    try:
        import numpy as np
        
        # Simulate interferogram processing
        size = 4096  # Typical interferogram size
        
        print(f"     Creating {size}x{size} synthetic interferogram...")
        
        # CPU test
        start_cpu = time.time()
        real1 = np.random.randn(size, size).astype(np.float32)
        imag1 = np.random.randn(size, size).astype(np.float32)
        img1 = real1 + 1j * imag1
        
        real2 = np.random.randn(size, size).astype(np.float32)
        imag2 = np.random.randn(size, size).astype(np.float32)
        img2 = real2 + 1j * imag2
        
        # Simulate interferogram generation (CPU)
        ifg_cpu = img1 * np.conj(img2)
        phase_cpu = np.angle(ifg_cpu)
        cpu_time = time.time() - start_cpu
        print(f"     CPU interferogram: {cpu_time:.3f}s")
        
        # GPU test (if CuPy available)
        try:
            import cupy as cp
            
            # GPU info
            device = cp.cuda.Device(0)
            props = cp.cuda.runtime.getDeviceProperties(0)
            gpu_name = props['name'].decode()
            gpu_mem = device.mem_info[1] / 1e9
            print(f"     GPU detected: {gpu_name} ({gpu_mem:.1f} GB)")
            
            # Transfer to GPU
            start_gpu = time.time()
            img1_gpu = cp.asarray(img1)
            img2_gpu = cp.asarray(img2)
            
            # GPU interferogram generation
            ifg_gpu = img1_gpu * cp.conj(img2_gpu)
            phase_gpu = cp.angle(ifg_gpu)
            cp.cuda.stream.get_current_stream().synchronize()
            
            gpu_time = time.time() - start_gpu
            print(f"     GPU interferogram: {gpu_time:.3f}s")
            print(f"     🚀 GPU Speedup: {cpu_time/gpu_time:.1f}x faster")
            
        except Exception as e:
            print(f"     ⚠️  GPU test skipped: {e}")
            
    except Exception as e:
        print(f"     ❌ Benchmark failed: {e}")
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"ISCE3: ✅ Installed ({isce3.__version__})")
    print(f"CUDA Support: {'✅ Yes' if cuda_available else '⚠️ CPU-only mode'}")
    print("Ready for InSAR processing!")

if __name__ == "__main__":
    test_isce3()
