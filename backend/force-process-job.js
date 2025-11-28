// Script pour forcer le traitement d'un job qui a été manqué
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function forceProcessJob(jobId) {
  console.log(`\n🔄 Forçage du traitement du job ${jobId}...`);
  
  try {
    // 1. Récupérer le job
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
    
    if (!job) {
      console.error('❌ Job non trouvé');
      process.exit(1);
    }
    
    console.log(`✅ Job trouvé: ${job.hy3_job_id}`);
    console.log(`   Status actuel: ${job.status}`);
    
    // 2. Importer et exécuter le worker
    const { processInSARJob } = require('./dist/workers/insarWorker');
    
    console.log('\n⏳ Traitement en cours...');
    
    // 3. Exécuter le traitement
    await processInSARJob({
      data: {
        jobId: job.id,
        hyp3JobId: job.hy3_job_id,
        infrastructureId: job.infrastructure_id,
        createdAt: Date.now()
      }
    });
    
    console.log('\n✅ Traitement terminé avec succès !');
    console.log('   Vérifie les déformations en DB');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Job ID à traiter
const jobId = '0fb97f5a-15db-475d-be70-1bddcb32fd19';
forceProcessJob(jobId);
