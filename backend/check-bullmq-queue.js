require('dotenv').config();
const { Queue } = require('bullmq');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

async function checkQueue() {
  const queue = new Queue('insar-processing', { connection: redisConnection });
  
  console.log('\n🔍 VÉRIFICATION QUEUE BullMQ\n');
  
  try {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    
    console.log(`📊 État de la queue:`);
    console.log(`   Waiting: ${waiting.length}`);
    console.log(`   Active: ${active.length}`);
    console.log(`   Completed: ${completed.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Delayed: ${delayed.length}\n`);
    
    // Chercher notre job spécifique
    const jobId = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71';
    
    console.log(`🔍 Recherche du job ${jobId}...\n`);
    
    const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
    const ourJob = allJobs.find(j => j.data && j.data.jobId === jobId);
    
    if (ourJob) {
      console.log(`✅ Job trouvé dans la queue !`);
      console.log(`   État: ${await ourJob.getState()}`);
      console.log(`   Tentatives: ${ourJob.attemptsMade}/${ourJob.opts.attempts}`);
      console.log(`   Données:`, JSON.stringify(ourJob.data, null, 2));
      console.log(`   Créé: ${new Date(ourJob.timestamp).toLocaleString('fr-FR')}\n`);
    } else {
      console.log(`❌ Job NON TROUVÉ dans la queue BullMQ !`);
      console.log(`   → Le job n'a jamais été ajouté à la queue`);
      console.log(`   → Le worker ne peut pas le traiter\n`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await queue.close();
  }
}

checkQueue();
