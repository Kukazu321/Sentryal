// Créer une infrastructure TEST simple avec 1 point (Tour Eiffel)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USER_ID = '3cfdec71-668c-4af6-8bd8-4671ecfba909'; // Charlie
const LAT = 48.8584; // Tour Eiffel
const LON = 2.2945;

async function create() {
  try {
    console.log('\n🏗️  Création infrastructure TEST...\n');
    
    // 1. Créer l'infrastructure
    const infraId = await prisma.$queryRaw`
      INSERT INTO infrastructures (id, user_id, name, type, mode_onboarding, bbox, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${USER_ID},
        'Test Tour Eiffel',
        'BRIDGE',
        'ADDRESS',
        ST_MakeEnvelope(${LON - 0.01}, ${LAT - 0.01}, ${LON + 0.01}, ${LAT + 0.01}, 4326),
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    
    const infraIdValue = infraId[0].id;
    console.log(`✅ Infrastructure créée: ${infraIdValue}`);
    
    // 2. Créer 1 point au centre
    await prisma.$queryRaw`
      INSERT INTO points (id, infrastructure_id, geom, soil_type, created_at)
      VALUES (
        gen_random_uuid(),
        ${infraIdValue},
        ST_SetSRID(ST_MakePoint(${LON}, ${LAT}), 4326),
        'CLAY',
        NOW()
      )
    `;
    
    console.log(`✅ 1 point créé (${LAT}, ${LON})`);
    
    // 3. Créer le job InSAR
    console.log('\n🚀 Création job InSAR...\n');
    
    const { Queue } = require('bullmq');
    const queue = new Queue('insar-processing', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null
      }
    });
    
    // Créer le job en DB
    const jobId = await prisma.$queryRaw`
      INSERT INTO jobs (id, infrastructure_id, status, bbox, created_at)
      VALUES (
        gen_random_uuid(),
        ${infraIdValue},
        'PENDING',
        ST_MakeEnvelope(${LON - 0.01}, ${LAT - 0.01}, ${LON + 0.01}, ${LAT + 0.01}, 4326),
        NOW()
      )
      RETURNING id
    `;
    
    const jobIdValue = jobId[0].id;
    console.log(`✅ Job créé: ${jobIdValue}`);
    
    // Ajouter à la queue (le worker va créer le job HyP3)
    await queue.add('process-insar', {
      jobId: jobIdValue,
      infrastructureId: infraIdValue,
      createdAt: Date.now()
    }, {
      attempts: 50,
      backoff: {
        type: 'exponential',
        delay: 30000
      }
    });
    
    console.log(`✅ Job ajouté à la queue BullMQ\n`);
    
    console.log('📋 IDs:');
    console.log(`   Infrastructure: ${infraIdValue}`);
    console.log(`   Job: ${jobIdValue}`);
    console.log('\n⏳ Le worker va:');
    console.log('   1. Chercher des images Sentinel-1');
    console.log('   2. Créer un job HyP3');
    console.log('   3. Poller le status');
    console.log('   4. Télécharger et parser les résultats');
    console.log('\n⏱️  Durée: 25-40 minutes\n');
    
    await queue.close();
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

create();
