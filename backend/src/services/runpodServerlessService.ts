/**
 * SENTRYAL - RunPod Serverless Client
 * ====================================
 * Service pour interagir avec l'API RunPod Serverless.
 * Remplace l'ancienne architecture SSH vers pods GPU.
 * 
 * Architecture:
 *   Backend -> RunPod Serverless API -> Worker ISCE3 -> Résultats
 * 
 * Avantages:
 *   - Pas de coût quand inactif (pay-per-job)
 *   - Auto-scaling automatique
 *   - Pas de perte d'environnement (Docker pré-configuré)
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

// Types
interface RunPodJobInput {
    job_id: string;
    infrastructure_id: string;
    reference_granule: string;
    secondary_granule: string;
    reference_url: string;
    secondary_url: string;
    bbox: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    points: Array<{
        id: string;
        lat: number;
        lon: number;
    }>;
    webhook_url?: string;
}

interface RunPodJobResponse {
    id: string;
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    output?: {
        job_id: string;
        status: 'success' | 'error';
        results?: {
            interferogram_url: string;
            coherence_url: string;
            displacement_url: string;
            displacement_points: Array<{
                point_id: string;
                displacement_mm: number;
                coherence: number;
                valid: boolean;
            }>;
            statistics: {
                mean_coherence: number;
                mean_displacement_mm: number;
                min_displacement_mm: number;
                max_displacement_mm: number;
                valid_points: number;
            };
        };
        processing_time_seconds: number;
        error?: string;
    };
    error?: string;
    executionTime?: number;
}

interface RunPodHealthResponse {
    jobs: {
        completed: number;
        failed: number;
        inProgress: number;
        inQueue: number;
    };
    workers: {
        idle: number;
        initializing: number;
        ready: number;
        running: number;
        throttled: number;
    };
}

export class RunPodServerlessService {
    private client: AxiosInstance;
    private endpointId: string;
    private webhookSecret: string;

    constructor() {
        const apiKey = process.env.RUNPOD_API_KEY;
        this.endpointId = process.env.RUNPOD_ENDPOINT_ID || '';
        this.webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET || '';

        if (!apiKey) {
            throw new Error('RUNPOD_API_KEY is required');
        }

        if (!this.endpointId) {
            throw new Error('RUNPOD_ENDPOINT_ID is required');
        }

        this.client = axios.create({
            baseURL: 'https://api.runpod.ai/v2',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        logger.info({ endpointId: this.endpointId }, 'RunPod Serverless client initialized');
    }

    /**
     * Submit a new InSAR processing job (async - returns immediately)
     * @param input Job parameters
     * @returns RunPod job ID for tracking
     */
    async submitJob(input: RunPodJobInput): Promise<string> {
        const startTime = Date.now();

        logger.info({
            jobId: input.job_id,
            referenceGranule: input.reference_granule,
            secondaryGranule: input.secondary_granule
        }, 'Submitting job to RunPod Serverless');

        try {
            const response = await this.client.post(`/${this.endpointId}/run`, {
                input
            });

            const runpodJobId = response.data.id;

            logger.info({
                jobId: input.job_id,
                runpodJobId,
                duration: Date.now() - startTime
            }, 'Job submitted successfully');

            return runpodJobId;

        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                jobId: input.job_id
            }, 'Failed to submit job to RunPod');
            throw error;
        }
    }

    /**
     * Submit a job and wait for completion (sync - blocks until done)
     * @param input Job parameters
     * @param timeoutMs Maximum wait time (default 30 minutes)
     * @returns Job output
     */
    async submitJobSync(input: RunPodJobInput, timeoutMs: number = 30 * 60 * 1000): Promise<RunPodJobResponse['output']> {
        const startTime = Date.now();

        logger.info({
            jobId: input.job_id,
            timeout: timeoutMs
        }, 'Submitting sync job to RunPod Serverless');

        try {
            const response = await this.client.post(`/${this.endpointId}/runsync`, {
                input: {
                    ...input,
                    job_id: input.job_id // Ensure job_id is explicitly at top level in input
                }
            }, {
                timeout: timeoutMs
            });

            const result = response.data as RunPodJobResponse;

            logger.info({
                jobId: input.job_id,
                status: result.status,
                executionTime: result.executionTime,
                duration: Date.now() - startTime
            }, 'Sync job completed');

            if (result.status === 'FAILED') {
                throw new Error(result.error || 'Job failed without error message');
            }

            return result.output;

        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                jobId: input.job_id
            }, 'Sync job failed');
            throw error;
        }
    }

    /**
     * Check the status of a submitted job
     * @param runpodJobId RunPod job ID
     * @returns Current job status and output if complete
     */
    async getJobStatus(runpodJobId: string): Promise<RunPodJobResponse> {
        try {
            const response = await this.client.get(`/${this.endpointId}/status/${runpodJobId}`);
            return response.data as RunPodJobResponse;
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                runpodJobId
            }, 'Failed to get job status');
            throw error;
        }
    }

    /**
     * Cancel a running or queued job
     * @param runpodJobId RunPod job ID
     */
    async cancelJob(runpodJobId: string): Promise<void> {
        try {
            await this.client.post(`/${this.endpointId}/cancel/${runpodJobId}`);
            logger.info({ runpodJobId }, 'Job cancelled');
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                runpodJobId
            }, 'Failed to cancel job');
            throw error;
        }
    }

    /**
     * Get endpoint health/queue status
     */
    async getHealth(): Promise<RunPodHealthResponse> {
        try {
            const response = await this.client.get(`/${this.endpointId}/health`);
            return response.data;
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to get endpoint health');
            throw error;
        }
    }

    /**
     * Purge all jobs in queue
     */
    async purgeQueue(): Promise<void> {
        try {
            await this.client.post(`/${this.endpointId}/purge-queue`);
            logger.info('Queue purged');
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to purge queue');
            throw error;
        }
    }

    /**
     * Verify webhook signature
     * @param payload Request body
     * @param signature Signature header
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        if (!this.webhookSecret) {
            logger.warn('No webhook secret configured, skipping verification');
            return true;
        }

        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(payload)
            .digest('hex');

        return signature === expectedSignature;
    }
}

// Singleton export
let runpodServiceInstance: RunPodServerlessService | null = null;

export function getRunPodService(): RunPodServerlessService {
    if (!runpodServiceInstance) {
        runpodServiceInstance = new RunPodServerlessService();
    }
    return runpodServiceInstance;
}

export default RunPodServerlessService;
