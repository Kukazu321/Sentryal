/**
 * GmtsarService
 * 
 * Interface principale pour le traitement InSAR avec GMTSAR
 * Suit la documentation GMTSAR officielle pour Sentinel-1 TOPS data
 * 
 * Workflow:
 * 1. Setup directory structure (raw/, SLC/, topo/, intf/)
 * 2. Download & organize SAR data (reference + secondary)
 * 3. Download precise orbit files for both images
 * 4. Download DEM covering the area
 * 5. Run preprocessing (make_s1a_tops)
 * 6. Run alignment (align_tops.csh)
 * 7. Create topo_ra.grd (dem2topo_ra.csh)
 * 8. Create interferogram (intf_tops.csh)
 * 9. Filter interferogram (filter.csh)
 * 10. Unwrap interferogram (snaphu.csh) - optional
 * 11. Geocode to lat/lon (geocode.csh)
 * 12. Convert radians to mm displacement
 * 13. Extract point measurements
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import logger from '../utils/logger';

export interface GmtsarConfig {
    gmtsarHome: string; // Path to GMTSAR installation
    workingDir: string; // Top level processing directory
    referenceGranule: {
        name: string;
        path: string;
    };
    secondaryGranule: {
        name: string;
        path: string;
    };
    demPath: string; // dem.grd file
    orbitDir: string; // Directory with orbit files
    bbox?: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
}

export interface ProcessingStage {
    stage: number; // 1-6: prep, align, topo, intf, unwrap, geocode
    name: string;
    completed: boolean;
    startedAt?: Date;
    completedAt?: Date;
    output?: string;
    error?: string;
}

export interface GmtsarResult {
    jobId: string;
    stages: ProcessingStage[];
    interferogramPath: string; // Path to final interferogram (lat/lon)
    unwrappedPath?: string; // Path to unwrapped interferogram
    displacementMmPath?: string; // Path to displacement in mm
    coherencePath?: string;
    temporalBaseline: number; // days between reference and secondary
    perpendicularBaseline: number; // meters (estimated)
    processingTime: number; // milliseconds
}

export class GmtsarService {
    private gmtsarHome: string;
    private workingDir: string;

    constructor(gmtsarHome?: string, workingDir?: string) {
        this.gmtsarHome = gmtsarHome || process.env.GMTSAR_HOME || '/usr/local/GMTSAR';
        this.workingDir = workingDir || process.env.GMTSAR_WORK_DIR || '/tmp/gmtsar_processing';
    }

    /**
     * Check if GMTSAR is properly installed and accessible
     */
    async checkInstallation(): Promise<boolean> {
        try {
            // Try running with no arguments. 
            // Note: p2p_S1_TOPS_Frame.csh often exits with 1 when showing usage, which execSync treats as an error.
            try {
                execSync(`${path.join(this.gmtsarHome, 'bin', 'p2p_S1_TOPS_Frame.csh')} 2>&1`, {
                    encoding: 'utf-8',
                    stdio: 'pipe'
                });
                return true;
            } catch (e: any) {
                // If it failed with exit code 1 but printed Usage, it's installed.
                const stdout = e.stdout ? e.stdout.toString() : '';
                const stderr = e.stderr ? e.stderr.toString() : '';
                const output = stdout + stderr;

                if (output.includes('Usage: p2p_S1_TOPS_Frame.csh')) {
                    logger.info('GMTSAR installation verified (via usage output)');
                    return true;
                }

                // Also check e.output array if it exists (node child_process structure)
                if (e.output && Array.isArray(e.output)) {
                    const combined = e.output.filter((o: any) => o).map((o: any) => o.toString()).join('');
                    if (combined.includes('Usage: p2p_S1_TOPS_Frame.csh')) {
                        logger.info('GMTSAR installation verified (via usage output array)');
                        return true;
                    }
                }

                logger.warn({ error: e, stdout, stderr }, 'GMTSAR check failed validation');
                throw e;
            }
        } catch (error) {
            logger.error({ error }, 'GMTSAR not properly installed or not in PATH');
            return false;
        }
    }

    /**
     * Set up directory structure for GMTSAR processing
     * Required: working_dir/raw/, working_dir/SLC/, working_dir/topo/, working_dir/intf/
     */
    async setupDirectoryStructure(workingDir: string): Promise<void> {
        const dirs = ['raw', 'SLC', 'topo', 'intf'];

        for (const dir of dirs) {
            const fullPath = path.join(workingDir, dir);
            await fs.mkdir(fullPath, { recursive: true });
            logger.info({ dir: fullPath }, 'Created GMTSAR directory');
        }
    }

    /**
     * Stage 1: Preprocessing - Prepare SLC files from raw SAR data
     * Converts raw Sentinel-1 data to SLC format
     */
    async stage1Preprocessing(config: GmtsarConfig): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 1,
            name: 'Preprocessing',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({ reference: config.referenceGranule.name, secondary: config.secondaryGranule.name }, 'Starting GMTSAR Stage 1: Preprocessing');

            // Check if SAR files exist in raw/
            const rawDir = path.join(config.workingDir, 'raw');
            const refExists = await this.fileExists(path.join(rawDir, config.referenceGranule.name));
            const secExists = await this.fileExists(path.join(rawDir, config.secondaryGranule.name));

            if (!refExists || !secExists) {
                throw new Error(`SAR files not found in ${rawDir}`);
            }

            // Run make_s1a_tops for reference image
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'make_s1a_tops')} ${config.referenceGranule.name} ${path.join(config.workingDir, 'raw')} ${path.join(config.workingDir, 'SLC')}`,
                config.workingDir,
                'Reference image preprocessing',
            );

            // Run make_s1a_tops for secondary image
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'make_s1a_tops')} ${config.secondaryGranule.name} ${path.join(config.workingDir, 'raw')} ${path.join(config.workingDir, 'SLC')}`,
                config.workingDir,
                'Secondary image preprocessing',
            );

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = 'SLC files generated';

            logger.info({ stage: stage.name }, 'Stage 1 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, stage: stage.name }, 'Stage 1 failed');
            throw error;
        }
    }

    /**
     * Stage 2: Alignment - Align secondary image to reference image
     * Uses SAR processing tools (esarp, xcorr, resamp)
     */
    async stage2Alignment(config: GmtsarConfig): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 2,
            name: 'Alignment',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({}, 'Starting GMTSAR Stage 2: Alignment');

            const slcDir = path.join(config.workingDir, 'SLC');
            const configFile = path.join(config.workingDir, 'config.tops.txt');

            // Create default config for TOPS data if not exists
            if (!await this.fileExists(configFile)) {
                await this.createDefaultConfig(configFile);
            }

            // Run alignment using align_tops.csh
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'align_tops.csh')} ${slcDir} ${configFile}`,
                config.workingDir,
                'Image alignment',
            );

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = 'Images aligned and resampled';

            logger.info({ stage: stage.name }, 'Stage 2 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, stage: stage.name }, 'Stage 2 failed');
            throw error;
        }
    }

    /**
     * Stage 3: Back Geocoding & topo_ra.grd creation
     * Creates topography in radar coordinates for phase removal
     */
    async stage3Geocoding(config: GmtsarConfig): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 3,
            name: 'Back Geocoding & Topo',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({}, 'Starting GMTSAR Stage 3: Back Geocoding');

            // Check DEM exists
            if (!await this.fileExists(config.demPath)) {
                throw new Error(`DEM file not found: ${config.demPath}`);
            }

            // Copy DEM to topo directory
            const topoDir = path.join(config.workingDir, 'topo');
            const demDest = path.join(topoDir, 'dem.grd');
            await fs.copyFile(config.demPath, demDest);

            // Run dem2topo_ra.csh to create topo_ra.grd
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'dem2topo_ra.csh')} ${path.join(config.workingDir, 'SLC', 'master.PRM')} ${demDest} ${path.join(topoDir, 'topo_ra.grd')}`,
                config.workingDir,
                'Topography in radar coordinates',
            );

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = 'topo_ra.grd created';

            logger.info({ stage: stage.name }, 'Stage 3 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, stage: stage.name }, 'Stage 3 failed');
            throw error;
        }
    }

    /**
     * Stage 4: Interferometry & Filtering
     * Create interferogram and filter it
     */
    async stage4Interferometry(config: GmtsarConfig): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 4,
            name: 'Interferometry & Filtering',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({}, 'Starting GMTSAR Stage 4: Interferometry');

            const intfDir = path.join(config.workingDir, 'intf');
            const slcDir = path.join(config.workingDir, 'SLC');
            const topoDir = path.join(config.workingDir, 'topo');

            // Run intf_tops.csh to create interferogram
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'intf_tops.csh')} ${slcDir} ${intfDir} ${topoDir}`,
                config.workingDir,
                'Interferogram creation',
            );

            // Run filter.csh to filter interferogram
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'filter.csh')} ${path.join(intfDir, 'phasefilt.grd')} 2 ${path.join(intfDir, 'phasefilt_filtered.grd')}`,
                config.workingDir,
                'Interferogram filtering',
            );

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = 'Interferogram created and filtered';

            logger.info({ stage: stage.name }, 'Stage 4 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, stage: stage.name }, 'Stage 4 failed');
            throw error;
        }
    }

    /**
     * Stage 5: Unwrapping (Optional but recommended)
     * Phase unwrapping using SNAPHU
     */
    async stage5Unwrapping(config: GmtsarConfig, threshold: number = 0.1): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 5,
            name: 'Phase Unwrapping',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({ threshold }, 'Starting GMTSAR Stage 5: Unwrapping');

            const intfDir = path.join(config.workingDir, 'intf');
            const configFile = path.join(config.workingDir, 'config.tops.txt');

            // Verify coherence file exists
            const coherencePath = path.join(intfDir, 'corr.grd');
            if (!await this.fileExists(coherencePath)) {
                logger.warn('Coherence file not found, skipping unwrapping');
                stage.completed = true;
                stage.output = 'Unwrapping skipped (no coherence data)';
                return stage;
            }

            // Create mask for coherence threshold
            const maskPath = path.join(intfDir, 'mask_def.grd');
            await this.runScript(
                `gmt grdmath ${coherencePath} ${threshold} GE 0 NAN = ${maskPath}`,
                intfDir,
                'Create coherence mask',
            );

            // Run snaphu unwrapping
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'snaphu.csh')} ${path.join(intfDir, 'phasefilt_filtered.grd')} ${maskPath}`,
                config.workingDir,
                'Phase unwrapping with SNAPHU',
            );

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = 'Phase unwrapped successfully';

            logger.info({ stage: stage.name }, 'Stage 5 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error, stage: stage.name }, 'Stage 5 failed (non-critical, continuing)');
            // Don't throw - unwrapping is optional
            return stage;
        }
    }

    /**
     * Stage 6: Geocoding to Latitude-Longitude
     * Project results to geographic coordinates
     */
    async stage6Geocoding(config: GmtsarConfig): Promise<ProcessingStage> {
        const stage: ProcessingStage = {
            stage: 6,
            name: 'Geocoding to Lat/Lon',
            completed: false,
            startedAt: new Date(),
        };

        try {
            logger.info({}, 'Starting GMTSAR Stage 6: Geocoding');

            const intfDir = path.join(config.workingDir, 'intf');
            const slcDir = path.join(config.workingDir, 'SLC');

            // Check trans.dat exists (created during processing)
            const transPath = path.join(slcDir, 'trans.dat');
            if (!await this.fileExists(transPath)) {
                throw new Error('trans.dat not found - geocoding cannot proceed');
            }

            // Try unwrapped interferogram first, fall back to wrapped
            let inputPath = path.join(intfDir, 'unwrap.grd');
            let outputPath = path.join(intfDir, 'unwrap_ll.grd');

            if (!await this.fileExists(inputPath)) {
                inputPath = path.join(intfDir, 'phasefilt.grd');
                outputPath = path.join(intfDir, 'phasefilt_ll.grd');
            }

            // Project to lat/lon
            await this.runScript(
                `${path.join(this.gmtsarHome, 'bin', 'proj_ra2ll.csh')} ${transPath} ${inputPath} ${outputPath}`,
                config.workingDir,
                'Project to geographic coordinates',
            );

            // Also geocode coherence
            const corrPath = path.join(intfDir, 'corr.grd');
            if (await this.fileExists(corrPath)) {
                await this.runScript(
                    `${path.join(this.gmtsarHome, 'bin', 'proj_ra2ll.csh')} ${transPath} ${corrPath} ${path.join(intfDir, 'corr_ll.grd')}`,
                    config.workingDir,
                    'Project coherence to geographic coordinates',
                );
            }

            stage.completed = true;
            stage.completedAt = new Date();
            stage.output = `Geocoded interferogram: ${outputPath}`;

            logger.info({ stage: stage.name, outputPath }, 'Stage 6 completed successfully');
            return stage;
        } catch (error) {
            stage.error = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, stage: stage.name }, 'Stage 6 failed');
            throw error;
        }
    }

    /**
     * Convert wrapped phase from radians to displacement in millimeters
     * Sentinel-1 wavelength: 0.0554658 m (5.546cm)
     * Conversion factor: -79.58 (includes 4π factor)
     */
    async convertPhaseToDisplacement(config: GmtsarConfig): Promise<string> {
        const intfDir = path.join(config.workingDir, 'intf');
        const wavelength = 0.0554658; // Sentinel-1 wavelength in meters

        try {
            // Try unwrapped first
            let inputPath = path.join(intfDir, 'unwrap_ll.grd');
            let outputPath = path.join(intfDir, 'displacement_ll_mm.grd');

            if (!await this.fileExists(inputPath)) {
                inputPath = path.join(intfDir, 'phasefilt_ll.grd');
                outputPath = path.join(intfDir, 'phase_ll_mm.grd');
            }

            // Convert radians to mm: phase (rad) * wavelength (m) * -79.58 = LOS displacement (mm)
            await this.runScript(
                `gmt grdmath ${inputPath} ${wavelength} MUL -79.58 MUL = ${outputPath}`,
                intfDir,
                'Convert phase to displacement (mm)',
            );

            logger.info({ outputPath }, 'Phase converted to displacement in mm');
            return outputPath;
        } catch (error) {
            logger.error({ error }, 'Failed to convert phase to displacement');
            throw error;
        }
    }

    /**
     * Full processing pipeline: stages 1-6
     */
    async processFullPipeline(config: GmtsarConfig): Promise<GmtsarResult> {
        const startTime = Date.now();
        const stages: ProcessingStage[] = [];

        try {
            logger.info({ workingDir: config.workingDir }, 'Starting full GMTSAR pipeline');

            // Setup directories
            await this.setupDirectoryStructure(config.workingDir);

            // Stage 1: Preprocessing
            stages.push(await this.stage1Preprocessing(config));

            // Stage 2: Alignment
            stages.push(await this.stage2Alignment(config));

            // Stage 3: Geocoding & Topo
            stages.push(await this.stage3Geocoding(config));

            // Stage 4: Interferometry
            stages.push(await this.stage4Interferometry(config));

            // Stage 5: Unwrapping (optional)
            try {
                stages.push(await this.stage5Unwrapping(config));
            } catch (error) {
                logger.warn('Unwrapping failed, continuing without unwrapping');
            }

            // Stage 6: Geocoding
            stages.push(await this.stage6Geocoding(config));

            // Convert phase to displacement
            const displacementPath = await this.convertPhaseToDisplacement(config);

            const result: GmtsarResult = {
                jobId: path.basename(config.workingDir),
                stages,
                interferogramPath: path.join(config.workingDir, 'intf', 'phasefilt_ll.grd'),
                unwrappedPath: path.join(config.workingDir, 'intf', 'unwrap_ll.grd'),
                displacementMmPath: displacementPath,
                coherencePath: path.join(config.workingDir, 'intf', 'corr_ll.grd'),
                temporalBaseline: this.calculateTemporalBaseline(config.referenceGranule.name, config.secondaryGranule.name),
                perpendicularBaseline: 0, // TODO: Calculate from baseline file
                processingTime: Date.now() - startTime,
            };

            logger.info(
                {
                    jobId: result.jobId,
                    processingTime: result.processingTime,
                    displacementPath: result.displacementMmPath,
                },
                'GMTSAR pipeline completed successfully',
            );

            return result;
        } catch (error) {
            logger.error({ error, completedStages: stages.length }, 'GMTSAR pipeline failed');
            throw error;
        }
    }

    /**
     * Helper: Execute a script/command with proper error handling
     */
    private async runScript(command: string, workingDir: string, description: string): Promise<string> {
        return new Promise((resolve, reject) => {
            logger.info({ command, description }, 'Running GMTSAR command');

            try {
                const result = execSync(command, {
                    cwd: workingDir,
                    encoding: 'utf-8',
                    timeout: 3600000, // 1 hour timeout
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });

                logger.debug({ description, output: result.substring(0, 500) }, 'Command completed');
                resolve(result);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                logger.error({ description, error: errorMsg }, 'Command failed');
                reject(new Error(`${description} failed: ${errorMsg}`));
            }
        });
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
     * Helper: Create default GMTSAR config for Sentinel-1 TOPS
     */
    private async createDefaultConfig(configPath: string): Promise<void> {
        const config = `# Default GMTSAR config for Sentinel-1 TOPS
# Swath: IW
# Polarization: VV or VH
# Processing level: L1

# Parameters
num_patches = 1
skip_init = 0
memory_ratio = 0.75

# Sentinel-1 TOPS specifics
filter_wavelength = 200
dec_factor = 1
range_dec = 2
azimuth_dec = 1

# Phase unwrapping
threshold_snaphu = 0.1
defomax = 0
region_cut = 20
switch_land = 1
detrend = 0
range_filtering = 1
azimuth_filtering = 1

# Geocoding
geocode = 1
proc_stage = 5

# Reference point (optional)
# reference_lon = 0.0
# reference_lat = 0.0
`;

        await fs.writeFile(configPath, config, 'utf-8');
        logger.info({ configPath }, 'Default config file created');
    }

    /**
     * Helper: Calculate temporal baseline from granule names
     * Sentinel-1 naming: S1A_IW_SLC__1SDV_20190704T...
     */
    private calculateTemporalBaseline(ref: string, sec: string): number {
        try {
            // Extract dates from granule names (format: S1A_IW_SLC__1SDV_YYYYMMDD...)
            const refDate = new Date(ref.substring(17, 21) + '-' + ref.substring(21, 23) + '-' + ref.substring(23, 25));
            const secDate = new Date(sec.substring(17, 21) + '-' + sec.substring(21, 23) + '-' + sec.substring(23, 25));

            const diffTime = Math.abs(secDate.getTime() - refDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays;
        } catch (error) {
            logger.warn({ error }, 'Failed to calculate temporal baseline');
            return 0;
        }
    }
}

export const gmtsarService = new GmtsarService();
