import { execSync } from 'child_process';
import logger from '../utils/logger';

interface GeoPoint {
    id: string;
    latitude: number;
    longitude: number;
}

interface DisplacementPoint {
    pointId: string;
    latitude: number;
    longitude: number;
    losDisplacementMm: number;
    coherence: number;
    valid: boolean;
}

interface GDALExtractionResult {
    points: DisplacementPoint[];
    stats: {
        validCount: number;
        invalidCount: number;
        meanDisplacement: number;
        meanCoherence: number;
        minDisplacement: number;
        maxDisplacement: number;
    };
}

/**
 * GDAL Service - High-performance GeoTIFF parsing via WSL
 * Extracts displacement and coherence values at specific geographic coordinates
 * 
 * Architecture:
 * - Uses GDAL tools in WSL2 Ubuntu environment
 * - Batch processing for optimal performance
 * - Error handling with fallback values
 * - Statistical analysis of results
 */
export class GDALService {
    private wslDistro = 'Ubuntu-22.04';
    private condaEnv = 'isce3';
    private readonly NODATA_VALUE = -9999;
    private readonly MAX_BATCH_SIZE = 1000;

    /**
     * Build command for execution (Native Linux or WSL)
     */
    private buildCommand(command: string): string {
        if (process.platform === 'win32') {
            return `wsl -d ${this.wslDistro} bash -c "source ~/miniconda3/etc/profile.d/conda.sh && conda activate ${this.condaEnv} && ${command}"`;
        } else {
            // Native Linux execution
            // Assuming gdal is installed in the environment or via conda
            // If using conda on linux:
            // return `bash -c "source ~/miniconda3/etc/profile.d/conda.sh && conda activate ${this.condaEnv} && ${command}"`;
            // But for now, let's assume gdal is in PATH (e.g. installed via apt-get install gdal-bin)
            return command;
        }
    }

    /**
     * Check if GDAL is installed
     */
    async checkInstallation(): Promise<{ installed: boolean; version?: string; error?: string }> {
        try {
            const result = execSync(
                this.buildCommand('gdalinfo --version'),
                { encoding: 'utf-8', timeout: 5000 }
            ).trim();

            logger.info({ version: result }, 'GDAL version check successful');
            return { installed: true, version: result };
        } catch (error: any) {
            logger.error({ error: error.message }, 'GDAL not properly installed');
            return {
                installed: false,
                error: error.message
            };
        }
    }

    /**
     * Extract displacement values at specific points from GeoTIFF
     * Uses gdallocationinfo for precise coordinate sampling
     */
    async extractDisplacementAtPoints(
        displacementPath: string,
        coherencePath: string,
        points: GeoPoint[]
    ): Promise<GDALExtractionResult> {

        logger.info({
            displacementPath,
            coherencePath,
            pointCount: points.length
        }, 'Extracting displacement values from GeoTIFF');

        try {
            const results: DisplacementPoint[] = [];

            // Process in batches for performance
            const batches = this.createBatches(points, this.MAX_BATCH_SIZE);

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                logger.info({ batchNum: i + 1, batchSize: batch.length }, 'Processing batch');

                const batchResults = await this.processBatch(
                    displacementPath,
                    coherencePath,
                    batch
                );

                results.push(...batchResults);
            }

            // Calculate statistics
            const validPoints = results.filter(p => p.valid);
            const stats = this.calculateStatistics(validPoints);

            logger.info({
                totalPoints: results.length,
                validPoints: validPoints.length,
                stats
            }, 'GeoTIFF extraction completed');

            return {
                points: results,
                stats
            };

        } catch (error: any) {
            logger.error({
                error: error.message,
                displacementPath,
                coherencePath
            }, 'Failed to extract displacement values');

            throw new Error(`GDAL extraction failed: ${error.message}`);
        }
    }

    /**
     * Process a batch of points using GDAL
     */
    private async processBatch(
        displacementPath: string,
        coherencePath: string,
        points: GeoPoint[]
    ): Promise<DisplacementPoint[]> {

        const results: DisplacementPoint[] = [];

        // Convert Windows paths to WSL paths
        const wslDisplacementPath = this.toWSLPath(displacementPath);
        const wslCoherencePath = this.toWSLPath(coherencePath);

        for (const point of points) {
            try {
                // Extract displacement value (in radians, LOS direction)
                const dispValue = await this.extractValueAtCoordinate(
                    wslDisplacementPath,
                    point.longitude,
                    point.latitude
                );

                // Extract coherence value (0-1 range)
                const cohValue = await this.extractValueAtCoordinate(
                    wslCoherencePath,
                    point.longitude,
                    point.latitude
                );

                // Convert radians to millimeters
                // Sentinel-1 C-band wavelength = 5.6 cm
                // displacement_mm = (phase_rad / (4 * PI)) * wavelength_mm
                const wavelength_mm = 56; // 5.6 cm
                const displacement_mm = (dispValue / (4 * Math.PI)) * wavelength_mm;

                const valid = this.isValidValue(dispValue) && this.isValidValue(cohValue);

                results.push({
                    pointId: point.id,
                    latitude: point.latitude,
                    longitude: point.longitude,
                    losDisplacementMm: valid ? displacement_mm : 0,
                    coherence: valid ? cohValue : 0,
                    valid
                });

            } catch (error: any) {
                logger.warn({
                    pointId: point.id,
                    error: error.message
                }, 'Failed to extract value at point');

                // Add invalid point
                results.push({
                    pointId: point.id,
                    latitude: point.latitude,
                    longitude: point.longitude,
                    losDisplacementMm: 0,
                    coherence: 0,
                    valid: false
                });
            }
        }

        return results;
    }

    /**
     * Extract raster value at specific coordinate using gdallocationinfo
     */
    private async extractValueAtCoordinate(
        rasterPath: string,
        longitude: number,
        latitude: number
    ): Promise<number> {

        try {
            const command = this.buildCommand(`gdallocationinfo -valonly -geoloc '${rasterPath}' ${longitude} ${latitude}`);

            const output = execSync(command, {
                encoding: 'utf-8',
                timeout: 5000,
                maxBuffer: 1024 * 1024
            }).trim();

            const value = parseFloat(output);

            if (isNaN(value)) {
                throw new Error(`Invalid value returned: ${output}`);
            }

            return value;

        } catch (error: any) {
            logger.debug({
                longitude,
                latitude,
                error: error.message
            }, 'Failed to extract value at coordinate');

            return this.NODATA_VALUE;
        }
    }

    /**
     * Convert Windows path to WSL path
     * C:\temp\file.tif -> /mnt/c/temp/file.tif
     */
    private toWSLPath(windowsPath: string): string {
        if (process.platform !== 'win32') {
            return windowsPath;
        }

        // Handle both forward and backward slashes
        const normalized = windowsPath.replace(/\\/g, '/');

        // Extract drive letter and path
        const match = normalized.match(/^([A-Z]):(.*)/i);

        if (match) {
            const drive = match[1].toLowerCase();
            const path = match[2];
            return `/mnt/${drive}${path}`;
        }

        // Already a WSL path or relative path
        return normalized;
    }

    /**
     * Check if value is valid (not NODATA)
     */
    private isValidValue(value: number): boolean {
        return !isNaN(value) &&
            value !== this.NODATA_VALUE &&
            isFinite(value);
    }

    /**
     * Create batches from array
     */
    private createBatches<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];

        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }

        return batches;
    }

    /**
     * Calculate statistics from valid points
     */
    private calculateStatistics(points: DisplacementPoint[]): {
        validCount: number;
        invalidCount: number;
        meanDisplacement: number;
        meanCoherence: number;
        minDisplacement: number;
        maxDisplacement: number;
    } {
        if (points.length === 0) {
            return {
                validCount: 0,
                invalidCount: 0,
                meanDisplacement: 0,
                meanCoherence: 0,
                minDisplacement: 0,
                maxDisplacement: 0
            };
        }

        const displacements = points.map(p => p.losDisplacementMm);
        const coherences = points.map(p => p.coherence);

        return {
            validCount: points.length,
            invalidCount: 0,
            meanDisplacement: this.mean(displacements),
            meanCoherence: this.mean(coherences),
            minDisplacement: Math.min(...displacements),
            maxDisplacement: Math.max(...displacements)
        };
    }

    /**
     * Calculate mean of array
     */
    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Extract entire GeoTIFF as numpy array (for advanced processing)
     * Returns Python script that can be executed in WSL
     */
    generateExtractionScript(
        displacementPath: string,
        coherencePath: string,
        outputPath: string
    ): string {
        const wslDisplacementPath = this.toWSLPath(displacementPath);
        const wslCoherencePath = this.toWSLPath(coherencePath);
        const wslOutputPath = this.toWSLPath(outputPath);

        return `#!/usr/bin/env python3
"""
GDAL GeoTIFF Extraction Script
Extracts displacement and coherence arrays for analysis
"""

import numpy as np
from osgeo import gdal
import json

print("Loading displacement GeoTIFF...")
disp_ds = gdal.Open("${wslDisplacementPath}")
disp_band = disp_ds.GetRasterBand(1)
disp_array = disp_band.ReadAsArray()

print("Loading coherence GeoTIFF...")
coh_ds = gdal.Open("${wslCoherencePath}")
coh_band = coh_ds.GetRasterBand(1)
coh_array = coh_band.ReadAsArray()

# Get geotransform for coordinate conversion
geotransform = disp_ds.GetGeoTransform()

# Convert phase to displacement (mm)
wavelength_mm = 56  # Sentinel-1 C-band
displacement_mm = (disp_array / (4 * np.pi)) * wavelength_mm

# Create output data structure
output = {
    'shape': list(disp_array.shape),
    'geotransform': list(geotransform),
    'projection': disp_ds.GetProjection(),
    'statistics': {
        'displacement': {
            'mean': float(np.nanmean(displacement_mm)),
            'std': float(np.nanstd(displacement_mm)),
            'min': float(np.nanmin(displacement_mm)),
            'max': float(np.nanmax(displacement_mm))
        },
        'coherence': {
            'mean': float(np.nanmean(coh_array)),
            'std': float(np.nanstd(coh_array)),
            'min': float(np.nanmin(coh_array)),
            'max': float(np.nanmax(coh_array))
        }
    }
}

# Save to JSON
with open("${wslOutputPath}", 'w') as f:
    json.dump(output, f, indent=2)

print(f"✓ Extraction complete: {wslOutputPath}")
print(f"  Displacement range: {output['statistics']['displacement']['min']:.2f} to {output['statistics']['displacement']['max']:.2f} mm")
print(f"  Mean coherence: {output['statistics']['coherence']['mean']:.3f}")
`;
    }
}

export const gdalService = new GDALService();
