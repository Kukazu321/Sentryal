// Script simple pour rajouter le job dans la queue Redis
require('dotenv').config();
const { Queue } = require('bullmq');

const JOB_ID = '0460869a-bc02-4ef7-adec-62d1b9329858';
const HYP3_JOB_ID = '970452b7-a505-4507-b5a7-36723ebb5b8d';
const INFRA_ID = 'fa68a304-cb43-4021-980d-605bff671d6d';

async function retryJob() {
  console.log('\n🔄 Ajout du job à la queue...\n');
  
  const queue = new Queue('insar-processing', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null
    }
  });
  
  try {
    await queue.add('process-insar', {
      jobId: JOB_ID,
      hyp3JobId: HYP3_JOB_ID,
      infrastructureId: INFRA_ID,
      createdAt: Date.now()
    });
    
    console.log('✅ Job ajouté à la queue !');
    console.log('   Le worker va le traiter dans quelques secondes...\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await queue.close();
    process.exit(0);
  }
}

retryJob();
