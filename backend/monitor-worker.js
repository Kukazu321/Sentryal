require('dotenv').config();
const { Queue } = require('bullmq');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

async function monitor() {
  const queue = new Queue('insar-processing', { connection: redisConnection });
  
  console.clear();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 WORKER MONITORING DASHBOARD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`⏰ ${new Date().toLocaleString('fr-FR')}\n`);
  
  try {
    // Queue stats
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    
    console.log('📊 QUEUE BULLMQ:');
    console.log(`   Waiting: ${waiting.length}`);
    console.log(`   Active: ${active.length}`);
    console.log(`   Completed: ${completed.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Delayed: ${delayed.length}\n`);
    
    // Active jobs details
    if (active.length > 0) {
      console.log('🔄 JOBS ACTIFS:\n');
      for (const job of active) {
        const elapsed = Math.floor((Date.now() - job.timestamp) / 60000);
        console.log(`   Job ${job.data.jobId.substring(0, 8)}...`);
        console.log(`     HyP3: ${job.data.hyp3JobId.substring(0, 8)}...`);
        console.log(`     Tentatives: ${job.attemptsMade}/${job.opts.attempts}`);
        console.log(`     Temps écoulé: ${elapsed} minutes\n`);
      }
    }
    
    // Recent failed jobs
    if (failed.length > 0) {
      console.log('❌ JOBS ÉCHOUÉS (derniers 5):\n');
      const recentFailed = failed.slice(0, 5);
      for (const job of recentFailed) {
        console.log(`   Job ${job.data.jobId.substring(0, 8)}...`);
        console.log(`     Erreur: ${job.failedReason?.substring(0, 80)}...`);
        console.log(`     Tentatives: ${job.attemptsMade}\n`);
      }
    }
    
    // Database stats
    const dbStats = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;
    
    console.log('💾 BASE DE DONNÉES (dernières 24h):');
    dbStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count}`);
    });
    console.log('');
    
    // Recent deformations
    const recentDef = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::int as count,
        MAX(created_at) as last_created
      FROM deformations
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;
    
    if (recentDef[0].count > 0) {
      console.log('📈 DÉFORMATIONS RÉCENTES (dernière heure):');
      console.log(`   Nouvelles: ${recentDef[0].count}`);
      console.log(`   Dernière: ${new Date(recentDef[0].last_created).toLocaleString('fr-FR')}\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Appuyez sur Ctrl+C pour quitter');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

// Run once
monitor();

// Auto-refresh every 30 seconds
setInterval(() => {
  monitor();
}, 30000);
