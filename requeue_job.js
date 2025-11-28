const Redis = require('ioredis');
const { Queue } = require('bullmq');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// IMPORTANT: must match workers/insarWorker.ts
const queue = new Queue('insar-processing', { connection });

async function requeue() {
  try {
    // Get latest job for the infrastructure with its HyP3 job id
    const rows = await prisma.$queryRaw`
      SELECT id, hy3_job_id, infrastructure_id
      FROM jobs
      WHERE infrastructure_id = '270e738d-056c-49e9-abda-59dc89754676'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      console.log('No job found for infrastructure');
      return;
    }

    const { id, hy3_job_id, infrastructure_id } = rows[0];

    // Add job to the processing queue with required fields
    const job = await queue.add(
      'process-insar',
      {
        jobId: id,
        hyp3JobId: hy3_job_id,
        infrastructureId: infrastructure_id,
        createdAt: Date.now(),
      },
      {
        attempts: 120,
        backoff: { type: 'fixed', delay: 30000 },
      }
    );

    console.log('✅ Job added to queue:', job.id);
    console.log('Queue: insar-processing');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    await connection.quit();
  }
}

requeue();
