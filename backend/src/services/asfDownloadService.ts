import axios from 'axios';
import { execSync } from 'child_process';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import extract from 'extract-zip';

interface DownloadOptions {
    granuleName: string;
    outputDir: string;
}

interface DownloadResult {
    success: boolean;
    safePath?: string;
    error?: string;
}

/**
 * ASF (Alaska Satellite Facility) Download Service
 * Downloads Sentinel-1 SLC granules from ASF DAAC using Earthdata credentials
 */
export class ASFDownloadService {
    private earthdataToken: string;
    private asfSearchUrl = 'https://api.daac.asf.alaska.edu/services/search/param';

    constructor() {
        this.earthdataToken = config.earthdata.bearerToken;

        if (!this.earthdataToken) {
            logger.warn('EARTHDATA_BEARER_TOKEN not configured. ASF downloads will fail.');
        }
    }    /**
     * Get download URL for a Sentinel-1 granule from ASF
     */
    private async getDownloadUrl(granuleName: string): Promise<string> {
        try {
            // ASF Search API to get download URL
            const searchUrl = `${this.asfSearchUrl}?granule_list=${granuleName}&output=json`;

            logger.info({ granuleName, searchUrl }, 'Fetching download URL from ASF');

            const response = await axios.get(searchUrl, {
                timeout: 30000,
                headers: { 'Accept': 'application/json' }
            });

            const parsedResponse = response.data;

            // ASF returns [[{...}, {...}]] - flatten the nested array
            const results = Array.isArray(parsedResponse[0]) ? parsedResponse[0] : parsedResponse;

            logger.info({
                granuleName,
                resultsCount: results?.length,
                processingLevels: results?.map((r: any) => r.processingLevel)
            }, 'ASF search results received');

            if (!results || results.length === 0) {
                throw new Error(`No results found for granule: ${granuleName}`);
            }

            // Filter for SLC product (not metadata)
            const slcProduct = results.find((r: any) =>
                r.processingLevel === 'SLC' && r.downloadUrl
            );

            if (!slcProduct || !slcProduct.downloadUrl) {
                logger.error({
                    granuleName,
                    availableProducts: results.map((r: any) => ({
                        level: r.processingLevel,
                        hasUrl: !!r.downloadUrl,
                        fileName: r.fileName
                    }))
                }, 'No SLC product found in results');
                throw new Error(`No SLC download URL found for granule: ${granuleName}`);
            }

            const downloadUrl = slcProduct.downloadUrl;
            logger.info({ granuleName, downloadUrl, sizeMB: slcProduct.sizeMB }, 'Got download URL from ASF');

            return downloadUrl;

        } catch (error: any) {
            logger.error({ error: error.message, granuleName }, 'Failed to get download URL from ASF');
            throw new Error(`Failed to get download URL: ${error.message}`);
        }
    }

    /**
     * Download Sentinel-1 SLC granule from ASF to local directory
     */
    async downloadGranule(options: DownloadOptions): Promise<DownloadResult> {
        const { granuleName, outputDir } = options;

        logger.info({ granuleName, outputDir }, 'Starting ASF granule download via asf_search');

        try {
            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Download using Python asf_search library - credentials via stdin to avoid shell escaping
            const scriptPath = path.join(__dirname, '../../scripts/download_asf.py');
            const zipPath = path.join(outputDir, `${granuleName}.zip`);

            logger.info({ granuleName, scriptPath }, 'Calling asf_search Python script');

            let command: string;
            let finalOutputDir = outputDir;

            if (process.platform === 'win32') {
                // Convert Windows path to WSL path
                const wslOutputDir = `/mnt/c${outputDir.substring(2).replace(/\\/g, '/')}`;
                const wslScriptPath = `/mnt/c${scriptPath.substring(2).replace(/\\/g, '/')}`;
                finalOutputDir = wslOutputDir;

                command = `wsl -d Ubuntu-22.04 bash -c "source ~/miniconda3/etc/profile.d/conda.sh && conda activate isce3 && python3 '${wslScriptPath}'"`;
            } else {
                // Linux / Production
                command = `python3 '${scriptPath}'`;
            }

            // Prepare JSON input with credentials (passed via stdin, NOT command line)
            const inputData = JSON.stringify({
                granule: granuleName,
                output_dir: finalOutputDir,
                username: process.env.EARTHDATA_USERNAME || 'charlie5999',
                password: process.env.EARTHDATA_PASSWORD || 'Ear08ata2025?!'
            });

            // Use execSync with input option to pass JSON directly to stdin
            const output = execSync(command, {
                input: inputData,
                encoding: 'utf-8',
                timeout: 120 * 60 * 1000, // 2 hours timeout for slow connections
                maxBuffer: 100 * 1024 * 1024
            });

            logger.info({ granuleName, output: output.trim() }, 'asf_search download completed');

            if (!fs.existsSync(zipPath)) {
                throw new Error(`Download failed: ${zipPath} not found after asf_search`);
            }

            const stats = fs.statSync(zipPath);
            logger.info({ granuleName, zipPath, sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Download verified');

            // Extract ZIP using native Node.js library
            logger.info({ granuleName, zipPath, outputDir }, 'Extracting SAFE package');

            await extract(zipPath, { dir: path.resolve(outputDir) });

            logger.info({ granuleName }, 'Extraction completed');

            // Find .SAFE directory
            const files = fs.readdirSync(outputDir);
            const safeDir = files.find(f => f.endsWith('.SAFE'));

            if (!safeDir) {
                throw new Error('No .SAFE directory found after extraction');
            }

            const safePath = path.join(outputDir, safeDir);
            logger.info({ granuleName, safePath }, 'SAFE package extracted successfully');

            // Clean up ZIP file to save space
            fs.unlinkSync(zipPath);
            logger.info({ granuleName }, 'Cleaned up ZIP file');

            return {
                success: true,
                safePath
            };

        } catch (error: any) {
            logger.error({
                error: error.message,
                stderr: error.stderr?.toString(),
                stdout: error.stdout?.toString(),
                granuleName
            }, 'ASF granule download failed');

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Download both reference and secondary granules for InSAR pair
     */
    async downloadInSARPair(
        referenceGranule: string,
        secondaryGranule: string,
        outputDir: string
    ): Promise<{ reference?: string; secondary?: string; error?: string }> {

        logger.info({
            referenceGranule,
            secondaryGranule,
            outputDir
        }, 'Downloading InSAR pair from ASF');

        try {
            // Download reference granule
            const refResult = await this.downloadGranule({
                granuleName: referenceGranule,
                outputDir: path.join(outputDir, 'reference')
            });

            if (!refResult.success) {
                throw new Error(`Reference download failed: ${refResult.error}`);
            }

            // Download secondary granule
            const secResult = await this.downloadGranule({
                granuleName: secondaryGranule,
                outputDir: path.join(outputDir, 'secondary')
            });

            if (!secResult.success) {
                throw new Error(`Secondary download failed: ${secResult.error}`);
            }

            logger.info({
                referenceGranule,
                secondaryGranule,
                referencePath: refResult.safePath,
                secondaryPath: secResult.safePath
            }, 'InSAR pair downloaded successfully');

            return {
                reference: refResult.safePath,
                secondary: secResult.safePath
            };

        } catch (error: any) {
            logger.error({
                error: error.message,
                referenceGranule,
                secondaryGranule
            }, 'Failed to download InSAR pair');

            return {
                error: error.message
            };
        }
    }

    /**
     * Check if granule is already downloaded
     */
    isGranuleDownloaded(granuleName: string, baseDir: string): string | null {
        const safeName = `${granuleName}.SAFE`;
        const possiblePaths = [
            path.join(baseDir, 'reference', safeName),
            path.join(baseDir, 'secondary', safeName),
            path.join(baseDir, safeName)
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                logger.info({ granuleName, path: p }, 'Granule already downloaded');
                return p;
            }
        }

        return null;
    }

    /**
     * Get download URLs for granules (for RunPod Serverless)
     * Returns direct ASF download URLs that can be used remotely
     */
    async getDownloadUrls(
        referenceGranule: string,
        secondaryGranule: string
    ): Promise<{ reference: string; secondary: string }> {
        logger.info({ referenceGranule, secondaryGranule }, 'Getting ASF download URLs');

        const [refUrl, secUrl] = await Promise.all([
            this.getDownloadUrl(referenceGranule),
            this.getDownloadUrl(secondaryGranule)
        ]);

        return {
            reference: refUrl,
            secondary: secUrl
        };
    }
}

export const asfDownloadService = new ASFDownloadService();
