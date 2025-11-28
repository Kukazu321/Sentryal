// Vérifier le status directement sur NASA HyP3
require('dotenv').config();

const HYP3_JOB_ID = '275499f2-5de3-4f7a-907a-433124a350fb';

async function checkNASA() {
  try {
    console.log('\n🔍 Vérification directe NASA HyP3...\n');
    
    const response = await fetch(`https://hyp3-api.asf.alaska.edu/jobs/${HYP3_JOB_ID}`, {
      headers: {
        'Authorization': `Bearer ${process.env.EARTHDATA_BEARER_TOKEN}`
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Erreur HTTP: ${response.status}`);
      const text = await response.text();
      console.log(text);
      return;
    }
    
    const job = await response.json();
    
    console.log('📋 Status NASA:');
    console.log(`   Job ID: ${job.job_id}`);
    console.log(`   Status: ${job.status_code}`);
    console.log(`   Type: ${job.job_type}`);
    console.log(`   Créé: ${new Date(job.request_time).toLocaleString('fr-FR')}`);
    
    if (job.status_code === 'RUNNING') {
      const elapsed = Math.round((Date.now() - new Date(job.request_time).getTime()) / 60000);
      console.log(`   ⏱️  Durée écoulée: ${elapsed} minutes`);
      console.log('\n⚠️  Toujours en RUNNING après 1h');
      console.log('   → Soit NASA a une charge élevée');
      console.log('   → Soit le job est bloqué');
      console.log('   → Attendre encore 15-20 min ou créer un nouveau job\n');
    } else if (job.status_code === 'SUCCEEDED') {
      console.log(`\n✅ Job terminé !`);
      console.log(`   Fichiers: ${job.files.length}`);
      if (job.files.length > 0) {
        console.log(`   ZIP: ${job.files[0].filename}`);
      }
      console.log('\n💡 Le worker devrait traiter dans quelques secondes...\n');
    } else if (job.status_code === 'FAILED') {
      console.log('\n❌ Job a échoué sur NASA !');
      console.log(`   Raison: ${job.status_message || 'Non spécifiée'}\n`);
    } else {
      console.log(`\n⚠️  Status inattendu: ${job.status_code}\n`);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  }
}

checkNASA();
