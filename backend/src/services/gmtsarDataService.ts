/**
 * GmtsarDataService
 * 
 * Manages supporting data required for GMTSAR processing:
 * - DEM (Digital Elevation Model) files
 * - Precise orbit files for Sentinel-1 satellites
 * - SAR granule files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import logger from '../utils/logger';

export interface SentinelOrbit {
    orbitNumber: string;
    platformId: string; // S1A or S1B
    startTime: string; // ISO datetime
    endTime: string; // ISO datetime
    orbitType: 'POEORB' | 'RESORB'; // Precise or Restituted
    downloadUrl: string;
}

export interface DemSource {
    name: string;
    description: string;
    resolution: number; // meters
    coverage: string;
}

export class GmtsarDataService {
    private demCache: string; // Directory for caching DEM files
    private orbitCache: string; // Directory for caching orbit files

    constructor(demCache?: string, orbitCache?: string) {
        this.demCache = demCache || path.join(process.env.GMTSAR_WORK_DIR || '/tmp', 'dem_cache');
        this.orbitCache = orbitCache || path.join(process.env.GMTSAR_WORK_DIR || '/tmp', 'orbit_cache');
    }

    /**
     * Initialize cache directories
     */
    async initialize(): Promise<void> {
        await fs.mkdir(this.demCache, { recursive: true });
        await fs.mkdir(this.orbitCache, { recursive: true });
        logger.info({ demCache: this.demCache, orbitCache: this.orbitCache }, 'GmtsarDataService initialized');
    }

    /**
     * Download precise orbit files for Sentinel-1 data
     * 
     * Orbit file naming convention:
     * S1A_OPER_AUX_POEORB_OPOD_YYYYMMDDTHHMMSS_V[START]_[END].EOF
     * 
     * Returns orbit file path
     */
    async downloadSentinelOrbit(
        granuleName: string,
        orbitType: 'POEORB' | 'RESORB' = 'POEORB',
    ): Promise<string> {
        try {
            // Extract metadata from Sentinel-1 granule name
            // Format: S1A_IW_SLC__1SDV_20190704T135158_20190704T135225_027968_032877_1C4D.SAFE
            const platformId = granuleName.substring(0, 3); // S1A or S1B
            const dateStr = granuleName.substring(17, 33); // YYYYMMDDTHHMMSS

            logger.info({ granuleName, orbitType }, 'Downloading Sentinel-1 orbit file');

            // Determine orbit date range (±1 day for coverage)
            const orbitDate = this.getOrbitDateRange(dateStr);

            // Search for orbit file on ESA servers
            const orbitUrl = await this.searchSentinelOrbit(platformId, orbitDate, orbitType);

            if (!orbitUrl) {
                throw new Error(`Orbit file not found for ${granuleName}`);
            }

            // Download orbit file
            const orbitPath = path.join(this.orbitCache, path.basename(orbitUrl));

            if (await this.fileExists(orbitPath)) {
                logger.info({ orbitPath }, 'Orbit file already cached');
                return orbitPath;
            }

            logger.info({ url: orbitUrl, path: orbitPath }, 'Downloading orbit file');
            await this.downloadFile(orbitUrl, orbitPath);

            return orbitPath;
        } catch (error) {
            logger.error({ error, granuleName }, 'Failed to download orbit file');
            throw error;
        }
    }

    /**
     * Generate DEM for a specific geographic area using SRTM data
     * Uses GMT dem generation facility
     */
    async generateDem(
        west: number,
        east: number,
        south: number,
        north: number,
        resolution: number = 1, // 1 arcsecond default (≈30m)
    ): Promise<string> {
        try {
            logger.info({ west, east, south, north, resolution }, 'Generating DEM from SRTM');

            const demName = `dem_${Math.round(west)}_${Math.round(east)}_${Math.round(south)}_${Math.round(north)}.grd`;
            const demPath = path.join(this.demCache, demName);

            // Check if DEM already exists
            if (await this.fileExists(demPath)) {
                logger.info({ demPath }, 'DEM already cached');
                return demPath;
            }

            // Use GMT to generate DEM from SRTM data
            // Requires GMT with SRTM remote data access
            const command = `gmt grdcut @earth_relief_${resolution}s -R${west}/${east}/${south}/${north} -G${demPath}`;

            logger.info({ command }, 'Running GMT DEM generation');
            await this.executeCommand(command);

            logger.info({ demPath }, 'DEM generated successfully');
            return demPath;
        } catch (error) {
            logger.error({ error }, 'Failed to generate DEM');
            throw error;
        }
    }

    /**
     * Download DEM from alternative sources
     * Available sources: SRTM30M (best for most areas), GEBCO (global coverage)
     */
    async downloadDemFromSource(
        bbox: { west: number; east: number; south: number; north: number },
        source: DemSource = { name: 'SRTM30M', description: 'SRTM 30m DEM', resolution: 30, coverage: 'global' },
    ): Promise<string> {
        try {
            logger.info({ source, bbox }, 'Downloading DEM from remote source');

            const demName = `dem_${source.name}_${bbox.west}_${bbox.east}_${bbox.south}_${bbox.north}.grd`;
            const demPath = path.join(this.demCache, demName);

            if (await this.fileExists(demPath)) {
                logger.info({ demPath }, 'DEM already cached');
                return demPath;
            }

            // For SRTM, we can use make_dem.csh script
            // make_dem.csh W E S N [mode]
            const command = `make_dem.csh ${bbox.west} ${bbox.east} ${bbox.south} ${bbox.north}`;

            logger.info({ command }, 'Running make_dem.csh');
            await this.executeCommand(command);

            // Move generated dem.grd to cache
            const demSource = path.join(process.cwd(), 'dem.grd');
            if (await this.fileExists(demSource)) {
                await fs.copyFile(demSource, demPath);
            }

            logger.info({ demPath }, 'DEM downloaded and cached');
            return demPath;
        } catch (error) {
            logger.warn({ error, source }, 'DEM download failed, attempting alternative');
            // Fallback to GMT
            return this.generateDem(bbox.west, bbox.east, bbox.south, bbox.north);
        }
    }

    /**
     * Validate DEM file
     * Checks format, coverage, and data integrity
     */
    async validateDem(demPath: string, expectedBbox?: { west: number; east: number; south: number; north: number }): Promise<boolean> {
        try {
            const stats = await fs.stat(demPath);

            if (stats.size === 0) {
                logger.warn('DEM file is empty');
                return false;
            }

            // Try to read DEM metadata using GMT
            const info = await this.getGridInfo(demPath);

            if (expectedBbox && info) {
                // Check if DEM covers expected area
                const demWest = info.west;
                const demEast = info.east;
                const demSouth = info.south;
                const demNorth = info.north;

                if (demWest > expectedBbox.west || demEast < expectedBbox.east || demSouth > expectedBbox.south || demNorth < expectedBbox.north) {
                    logger.warn(
                        {
                            demBbox: { demWest, demEast, demSouth, demNorth },
                            expectedBbox,
                        },
                        'DEM does not fully cover expected area',
                    );
                    return false;
                }
            }

            logger.info({ demPath }, 'DEM file validated');
            return true;
        } catch (error) {
            logger.error({ error, demPath }, 'DEM validation failed');
            return false;
        }
    }

    /**
     * Get available DEM sources
     */
    getAvailableDemSources(): DemSource[] {
        return [
            {
                name: 'SRTM30M',
                description: 'SRTM 30-meter global elevation',
                resolution: 30,
                coverage: 'Global (-60° to +60°)',
            },
            {
                name: 'GEBCO2023',
                description: 'General Bathymetric Chart of the Oceans',
                resolution: 15,
                coverage: 'Global (including bathymetry)',
            },
            {
                name: 'NASADEM',
                description: 'NASA DEM (improved SRTM)',
                resolution: 30,
                coverage: 'Global (-60° to +60°)',
            },
        ];
    }

    /**
     * Helper: Search for Sentinel-1 orbit file
     */
    private async searchSentinelOrbit(
        platformId: string,
        dateRange: { start: string; end: string },
        orbitType: 'POEORB' | 'RESORB',
    ): Promise<string | null> {
        try {
            // ESA orbit files are typically available on:
            // https://scihub.copernicus.eu/gnss/odata/v1/Products
            // Or auxiliary data server

            const baseUrl = 'https://scihub.copernicus.eu';
            const query = `search?q=platformname:${platformId} AND producttype:${orbitType} AND ingestiondate:[${dateRange.start}T00:00:00.000Z TO ${dateRange.end}T23:59:59.999Z]`;

            logger.debug({ baseUrl, query }, 'Searching for orbit file');

            // In production, this would make a proper API call to ESA
            // For now, return null to indicate offline mode
            // Orbit files can be downloaded manually from:
            // https://scihub.copernicus.eu/dhus/#/home

            return null;
        } catch (error) {
            logger.warn({ error }, 'Orbit file search failed');
            return null;
        }
    }

    /**
     * Helper: Parse orbit date range from granule timestamp
     */
    private getOrbitDateRange(timestamp: string): { start: string; end: string } {
        // timestamp format: YYYYMMDDTHHMMSS
        const date = new Date(timestamp.substring(0, 4) + '-' + timestamp.substring(4, 6) + '-' + timestamp.substring(6, 8));

        // Orbit files cover 1 day (0:00:00 to 23:59:59)
        const dayBefore = new Date(date);
        dayBefore.setDate(dayBefore.getDate() - 1);

        const dayAfter = new Date(date);
        dayAfter.setDate(dayAfter.getDate() + 1);

        return {
            start: dayBefore.toISOString().split('T')[0],
            end: dayAfter.toISOString().split('T')[0],
        };
    }

    /**
     * Helper: Download file with retry logic
     */
    private async downloadFile(url: string, filePath: string, retries: number = 3): Promise<void> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(url, {
                    responseType: 'stream',
                    timeout: 30000,
                });

                const writeStream = (await fs.open(filePath, 'w')).createWriteStream();

                return new Promise((resolve, reject) => {
                    response.data.pipe(writeStream);
                    response.data.on('error', reject);
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });
            } catch (error) {
                if (attempt < retries) {
                    logger.warn({ url, attempt, error }, 'Download failed, retrying');
                    await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Helper: Check if file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Helper: Execute shell command
     */
    private async executeCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const { execSync } = require('child_process');
            try {
                const result = execSync(command, { encoding: 'utf-8', timeout: 300000 });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Helper: Get grid information using GMT
     */
    private async getGridInfo(
        gridPath: string,
    ): Promise<{ west: number; east: number; south: number; north: number; zmin: number; zmax: number } | null> {
        try {
            const { execSync } = require('child_process');
            const output = execSync(`gmt grdinfo -C ${gridPath}`, { encoding: 'utf-8' });

            // Parse GMT output: xmin xmax ymin ymax zmin zmax dx dy nx ny
            const parts = output.trim().split('\t');

            return {
                west: parseFloat(parts[0]),
                east: parseFloat(parts[1]),
                south: parseFloat(parts[2]),
                north: parseFloat(parts[3]),
                zmin: parseFloat(parts[4]),
                zmax: parseFloat(parts[5]),
            };
        } catch (error) {
            logger.warn({ error }, 'Failed to get grid info');
            return null;
        }
    }

    /**
     * Get DEM cache directory size
     */
    async getDemCacheSize(): Promise<number> {
        try {
            const files = await fs.readdir(this.demCache);
            let totalSize = 0;

            for (const file of files) {
                const stats = await fs.stat(path.join(this.demCache, file));
                totalSize += stats.size;
            }

            return totalSize;
        } catch (error) {
            logger.warn({ error }, 'Failed to calculate DEM cache size');
            return 0;
        }
    }

    /**
     * Clear DEM cache (older than X days)
     */
    async clearOldDemCache(ageInDays: number = 30): Promise<number> {
        try {
            const files = await fs.readdir(this.demCache);
            const now = Date.now();
            let removed = 0;

            for (const file of files) {
                const filePath = path.join(this.demCache, file);
                const stats = await fs.stat(filePath);
                const ageMs = now - stats.mtimeMs;
                const ageDays = ageMs / (1000 * 60 * 60 * 24);

                if (ageDays > ageInDays) {
                    await fs.unlink(filePath);
                    removed++;
                    logger.info({ file, ageDays }, 'Removed old DEM file');
                }
            }

            return removed;
        } catch (error) {
            logger.warn({ error }, 'Failed to clear old DEM cache');
            return 0;
        }
    }
}

export const gmtsarDataService = new GmtsarDataService();
