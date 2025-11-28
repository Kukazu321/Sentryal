import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics, register } from 'prom-client';
import type { Queue } from 'bullmq';

// Default registry and process metrics
collectDefaultMetrics({ register });

// Counters
export const jobsCompletedTotal = new Counter({
    name: 'insar_jobs_completed_total',
    help: 'Total number of completed InSAR jobs',
});

export const jobsFailedTotal = new Counter({
    name: 'insar_jobs_failed_total',
    help: 'Total number of failed InSAR jobs',
});

export const jobsEnqueuedTotal = new Counter({
    name: 'insar_jobs_enqueued_total',
    help: 'Total number of enqueued InSAR jobs',
});

// Duration of a job from processedOn to finishedOn
export const jobProcessingDurationSeconds = new Histogram({
    name: 'insar_job_processing_duration_seconds',
    help: 'Histogram of InSAR job processing durations (seconds)',
    buckets: [5, 10, 30, 60, 120, 300, 600, 1200],
});

// Queue gauges (updated on scrape)
const queueWaiting = new Gauge({ name: 'insar_queue_waiting', help: 'Number of waiting jobs' });
const queueActive = new Gauge({ name: 'insar_queue_active', help: 'Number of active jobs' });
const queueDelayed = new Gauge({ name: 'insar_queue_delayed', help: 'Number of delayed jobs' });
const queueFailed = new Gauge({ name: 'insar_queue_failed', help: 'Number of failed jobs' });
const queueCompleted = new Gauge({ name: 'insar_queue_completed', help: 'Number of completed jobs (retained)' });

export async function updateQueueGauges(queue: Queue) {
    try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        queueWaiting.set(counts.waiting || 0);
        queueActive.set(counts.active || 0);
        queueDelayed.set(counts.delayed || 0);
        queueFailed.set(counts.failed || 0);
        queueCompleted.set(counts.completed || 0);
    } catch (e) {
        // Set to NaN to indicate scrape failure
        queueWaiting.set(NaN);
        queueActive.set(NaN);
        queueDelayed.set(NaN);
        queueFailed.set(NaN);
        queueCompleted.set(NaN);
    }
}

export { register };
