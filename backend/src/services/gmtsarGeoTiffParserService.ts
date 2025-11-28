/**
 * GmtsarGeoTiffParserService
 * 
 * Parse GeoTIFF outputs from GMTSAR and extract displacement values
 * at specific geographic locations (latitude/longitude)
 * 
 * GMTSAR outputs:
 * - unwrap_ll.grd (unwrapped phase in lat/lon, units: radians)
 * - corr_ll.grd (coherence in lat/lon, units: 0-1)
 * - displacement_ll_mm.grd (LOS displacement in mm)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import logger from '../utils/logger';

export interface DisplacementPoint {
    pointId: string;
    latitude: number;
    longitude: number;
    losDisplacementMm: number; // Line-of-sight displacement
    coherence: number; // 0-1
    phaseRadians?: number;
    radarRange?: number;
    radarAzimuth?: number;
    quality: 'high' | 'medium' | 'low'; // Based on coherence
}

export interface DisplacementExtraction {
    jobId: string;
    referenceDate: string;
    secondaryDate: string;
    temporalBaseline: number;
    displacementPoints: DisplacementPoint[];
    stats: {
        pointsWithData: number;
        pointsNoData: number;
        meanDisplacement: number;
        stdDevDisplacement: number;
        minDisplacement: number;
        maxDisplacement: number;
        meanCoherence: number;
        highCoherenceCount: number; // coherence > 0.5
        mediumCoherenceCount: number; // 0.3-0.5
        lowCoherenceCount: number; // < 0.3
    };
}

export class GmtsarGeoTiffParserService {
    /**
     * Extract displacement values at specific lat/lon points from GMTSAR GeoTIFF output
     * Uses GMT grdtrack to sample grid files at point locations
     */
    async extractDisplacementAtPoints(
        displacementGridPath: string,
        coherenceGridPath: string,
        points: Array<{ id: string; latitude: number; longitude: number }>,
        jobId: string,
    ): Promise<DisplacementExtraction> {
        logger.info(
            { pointCount: points.length, displacementGrid: displacementGridPath },
            'Extracting displacement at points from GMTSAR output',
        );

        try {
            // Verify grids exist
            await this.verifyGridFile(displacementGridPath);
            if (coherenceGridPath) {
                await this.verifyGridFile(coherenceGridPath);
            }

            // Create temporary file with point locations (lon lat format for GMT)
            const pointsFile = await this.createPointsFile(points);

            try {
                // Sample displacement values using gmt grdtrack
                const displacementData = await this.sampleGrid(displacementGridPath, pointsFile);

                // Sample coherence values if available
                let coherenceData: Map<string, number> = new Map();
                if (coherenceGridPath) {
                    coherenceData = await this.sampleGridToMap(coherenceGridPath, pointsFile);
                }

                // Combine results
                const displacementPoints = this.combineResults(points, displacementData, coherenceData);

                // Calculate statistics
                const stats = this.calculateStatistics(displacementPoints);

                // Extract dates from grid metadata
                const { referenceDate, secondaryDate, temporalBaseline } = await this.extractDatesFromGrid(
                    displacementGridPath,
                );

                const result: DisplacementExtraction = {
                    jobId,
                    referenceDate,
                    secondaryDate,
                    temporalBaseline,
                    displacementPoints,
                    stats,
                };

                logger.info(
                    {
                        pointsExtracted: displacementPoints.length,
                        meanDisplacement: stats.meanDisplacement.toFixed(3),
                        meanCoherence: stats.meanCoherence.toFixed(3),
                    },
                    'Displacement extraction completed',
                );

                return result;
            } finally {
                // Clean up temporary file
                await fs.unlink(pointsFile).catch(() => { });
            }
        } catch (error) {
            logger.error({ error, displacementGrid: displacementGridPath }, 'Failed to extract displacement');
            throw error;
        }
    }

    /**
     * Create temporary file with point locations for GMT grdtrack
     * Format: longitude latitude (one point per line)
     */
    private async createPointsFile(points: Array<{ id: string; latitude: number; longitude: number }>): Promise<string> {
        const tempDir = '/tmp';
        const fileName = `points_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`;
        const filePath = path.join(tempDir, fileName);

        const content = points.map((p) => `${p.longitude} ${p.latitude} ${p.id}`).join('\n');

        await fs.writeFile(filePath, content, 'utf-8');
        return filePath;
    }

    /**
     * Sample GMT grid file at point locations
     * Returns map of point_id -> displacement value
     */
    private async sampleGrid(gridPath: string, pointsFile: string): Promise<Map<string, number>> {
        const result = new Map<string, number>();

        try {
            const output = execSync(`gmt grdtrack ${pointsFile} -G${gridPath} -Z`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            const lines = output.trim().split('\n');
            const pointLines = (await fs.readFile(pointsFile, 'utf-8')).trim().split('\n');

            lines.forEach((line, index) => {
                if (line && pointLines[index]) {
                    const parts = pointLines[index].split(' ');
                    const pointId = parts[2];
                    const value = parseFloat(line);

                    if (!isNaN(value)) {
                        result.set(pointId, value);
                    }
                }
            });

            return result;
        } catch (error) {
            logger.warn({ error, gridPath }, 'Failed to sample grid, returning empty results');
            return new Map();
        }
    }

    /**
     * Sample grid and return as Map for easier lookup
     */
    private async sampleGridToMap(gridPath: string, pointsFile: string): Promise<Map<string, number>> {
        return this.sampleGrid(gridPath, pointsFile);
    }

    /**
     * Combine displacement, coherence, and point metadata
     */
    private combineResults(
        points: Array<{ id: string; latitude: number; longitude: number }>,
        displacementData: Map<string, number>,
        coherenceData: Map<string, number>,
    ): DisplacementPoint[] {
        return points.map((point) => {
            const displacement = displacementData.get(point.id) || 0;
            const coherence = coherenceData.get(point.id) ?? 0.5; // Default to medium if not available

            // Determine quality based on coherence
            let quality: 'high' | 'medium' | 'low' = 'low';
            if (coherence > 0.5) {
                quality = 'high';
            } else if (coherence > 0.3) {
                quality = 'medium';
            }

            return {
                pointId: point.id,
                latitude: point.latitude,
                longitude: point.longitude,
                losDisplacementMm: displacement,
                coherence,
                quality,
            };
        });
    }

    /**
     * Calculate statistics from displacement points
     */
    private calculateStatistics(points: DisplacementPoint[]): DisplacementExtraction['stats'] {
        const validDisplacements = points.filter((p) => !isNaN(p.losDisplacementMm) && p.losDisplacementMm !== 0);
        const validCoherences = points.filter((p) => p.coherence > 0);

        const displacements = validDisplacements.map((p) => p.losDisplacementMm);
        const coherences = validCoherences.map((p) => p.coherence);

        const meanDisplacement = displacements.length > 0 ? displacements.reduce((a, b) => a + b) / displacements.length : 0;
        const minDisplacement = displacements.length > 0 ? Math.min(...displacements) : 0;
        const maxDisplacement = displacements.length > 0 ? Math.max(...displacements) : 0;

        const stdDevDisplacement =
            displacements.length > 1
                ? Math.sqrt(
                    displacements.reduce((acc, val) => acc + Math.pow(val - meanDisplacement, 2), 0) / (displacements.length - 1),
                )
                : 0;

        const meanCoherence = coherences.length > 0 ? coherences.reduce((a, b) => a + b) / coherences.length : 0;

        const highCoherenceCount = points.filter((p) => p.coherence > 0.5).length;
        const mediumCoherenceCount = points.filter((p) => p.coherence > 0.3 && p.coherence <= 0.5).length;
        const lowCoherenceCount = points.filter((p) => p.coherence <= 0.3).length;

        return {
            pointsWithData: validDisplacements.length,
            pointsNoData: points.length - validDisplacements.length,
            meanDisplacement,
            stdDevDisplacement,
            minDisplacement,
            maxDisplacement,
            meanCoherence,
            highCoherenceCount,
            mediumCoherenceCount,
            lowCoherenceCount,
        };
    }

    /**
     * Extract reference/secondary dates from grid file metadata
     * This is a placeholder - actual implementation depends on grid format
     */
    private async extractDatesFromGrid(
        gridPath: string,
    ): Promise<{ referenceDate: string; secondaryDate: string; temporalBaseline: number }> {
        try {
            // Try to read metadata using gmt grdinfo
            const info = execSync(`gmt grdinfo -C ${gridPath}`, {
                encoding: 'utf-8',
            });

            // Parse basic info, dates would be in extended metadata
            logger.debug({ info }, 'Grid info retrieved');

            // For now, return placeholder values
            // In production, these would be stored in the GeoTIFF metadata during GMTSAR processing
            return {
                referenceDate: new Date().toISOString().split('T')[0],
                secondaryDate: new Date().toISOString().split('T')[0],
                temporalBaseline: 0,
            };
        } catch (error) {
            logger.warn({ error }, 'Could not extract dates from grid');
            return {
                referenceDate: 'unknown',
                secondaryDate: 'unknown',
                temporalBaseline: 0,
            };
        }
    }

    /**
     * Verify grid file exists and is readable
     */
    private async verifyGridFile(gridPath: string): Promise<void> {
        try {
            const stats = await fs.stat(gridPath);
            if (stats.size === 0) {
                throw new Error('Grid file is empty');
            }
            logger.debug({ gridPath, size: stats.size }, 'Grid file verified');
        } catch (error) {
            throw new Error(`Grid file not accessible: ${gridPath}`);
        }
    }

    /**
     * Convert LOS (Line-of-Sight) displacement to vertical component
     * Requires look angle from SAR metadata
     * vertical ≈ LOS / cos(incidence_angle)
     */
    static convertLosToVertical(losDisplacement: number, incidenceAngleDegrees: number): number {
        const incidenceAngleRad = (incidenceAngleDegrees * Math.PI) / 180;
        return losDisplacement / Math.cos(incidenceAngleRad);
    }

    /**
     * Convert LOS displacement to horizontal (east-west) component
     * Requires decomposition with ascending/descending passes
     * horizontal ≈ LOS / sin(incidence_angle)
     */
    static convertLosToEastWest(losDisplacement: number, incidenceAngleDegrees: number): number {
        const incidenceAngleRad = (incidenceAngleDegrees * Math.PI) / 180;
        return losDisplacement / Math.sin(incidenceAngleRad);
    }
}

export const gmtsarGeoTiffParserService = new GmtsarGeoTiffParserService();
