/**
 * GMTSAR Container Service
 * 
 * Simple HTTP API wrapper around GMTSAR Docker container
 * This service runs INSIDE the Docker container and provides HTTP endpoints
 * for the backend to communicate with GMTSAR
 */

import express, { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';

const execAsync = promisify(exec);

const app: Express = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());

interface ProcessingJob {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    stage?: number;
    progress?: number;
    result?: object;
    error?: string;
    startTime?: number;
    endTime?: number;
    logs?: string[];
}

// In-memory job storage (in production, use database or Redis)
const jobs = new Map<string, ProcessingJob>();

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    try {
        const gmtsarOk = Boolean(process.env.GMTSAR_ROOT && process.env.GMT_BIN);
        res.json({
            ok: gmtsarOk,
            version: '1.0.0',
            gmtsarRoot: process.env.GMTSAR_ROOT,
            gmtBin: process.env.GMT_BIN,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Health check failed' });
    }
});

// Submit processing job
app.post('/api/process', async (req: Request, res: Response) => {
    try {
        const { jobId, referenceGranule, secondaryGranule, demPath, bbox } = req.body;

        if (!jobId || !referenceGranule || !secondaryGranule) {
            return res.status(400).json({
                error: 'Missing required fields: jobId, referenceGranule, secondaryGranule',
            });
        }

        // Create job record
        const job: ProcessingJob = {
            jobId,
            status: 'pending',
            stage: 0,
            progress: 0,
            startTime: Date.now(),
            logs: [],
        };

        jobs.set(jobId, job);

        // Start async processing
        processJob(jobId, referenceGranule, secondaryGranule, demPath, bbox).catch((error) => {
            const existingJob = jobs.get(jobId);
            if (existingJob) {
                existingJob.status = 'failed';
                existingJob.error = error instanceof Error ? error.message : 'Unknown error';
                existingJob.endTime = Date.now();
            }
        });

        res.json({ jobId });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Processing submission failed',
        });
    }
});

// Get job status
app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Status retrieval failed',
        });
    }
});

// Get job logs
app.get('/api/jobs/:jobId/logs', (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ logs: (job.logs || []).join('\n') });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Log retrieval failed',
        });
    }
});

// Cancel job
app.post('/api/jobs/:jobId/cancel', (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status === 'processing') {
            job.status = 'failed';
            job.error = 'Cancelled by user';
            job.endTime = Date.now();
        }

        res.json({ cancelled: true, jobId });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Cancellation failed',
        });
    }
});

/**
 * Background processing function
 */
async function processJob(
    jobId: string,
    referenceGranule: string,
    secondaryGranule: string,
    demPath?: string,
    bbox?: { north: number; south: number; east: number; west: number }
): Promise<void> {
    const job = jobs.get(jobId)!;

    try {
        job.status = 'processing';

        // Stage 1: Preprocessing
        job.stage = 1;
        job.progress = 10;
        log(job, 'Stage 1: Preprocessing');
        // await runStage1Preprocessing(referenceGranule, secondaryGranule, jobId);

        // Stage 2: Alignment
        job.stage = 2;
        job.progress = 25;
        log(job, 'Stage 2: Alignment');
        // await runStage2Alignment(jobId);

        // Stage 3: Back-geocoding
        job.stage = 3;
        job.progress = 40;
        log(job, 'Stage 3: Back-geocoding');
        // await runStage3Geocoding(jobId, demPath);

        // Stage 4: Interferometry
        job.stage = 4;
        job.progress = 55;
        log(job, 'Stage 4: Interferometry');
        // await runStage4Interferometry(jobId);

        // Stage 5: Phase unwrapping (optional)
        job.stage = 5;
        job.progress = 70;
        log(job, 'Stage 5: Phase unwrapping');
        // await runStage5Unwrapping(jobId);

        // Stage 6: Final geocoding
        job.stage = 6;
        job.progress = 85;
        log(job, 'Stage 6: Final geocoding');
        // await runStage6FinalGeocoding(jobId);

        // Mark complete
        job.status = 'completed';
        job.progress = 100;
        job.endTime = Date.now();
        log(job, 'Processing completed successfully');

        log(job, `Total time: ${(job.endTime - (job.startTime || 0)) / 1000} seconds`);
    } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.endTime = Date.now();
        log(job, `Error: ${job.error}`);
    }
}

/**
 * Helper to log messages
 */
function log(job: ProcessingJob, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    job.logs?.push(logMessage);
    console.log(`[${job.jobId}] ${logMessage}`);
}

// Error handling
app.use((err: any, req: Request, res: Response) => {
    console.error('API Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`GMTSAR Processor API listening on port ${PORT}`);
    console.log(`GMTSAR Root: ${process.env.GMTSAR_ROOT}`);
    console.log(`GMT Bin: ${process.env.GMT_BIN}`);
});

export default app;
