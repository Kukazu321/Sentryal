// Créer UNE infrastructure ULTRA SIMPLE : 1 point au centre de Paris
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USER_ID = '3cfdec71-668c-4af6-8bd8-4671ecfba909';
const LAT = 48.8566; // Centre de Paris
const LON = 2.3522;

async function create() {
  try {
    console.log('\n🏗️  Création infrastructure ULTRA SIMPLE (1 point Paris)...\n');
    
    // Créer l'infrastructure avec bbox TRÈS PETITE (100m autour du point)
    const delta = 0.001; // ~100m
    
    const infraId = await prisma.$queryRaw`
      INSERT INTO infrastructures (id, user_id, name, type, mode_onboarding, bbox, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${USER_ID},
        'Test Simple Paris',
        'BRIDGE',
        'ADDRESS',
        ST_MakeEnvelope(${LON - delta}, ${LAT - delta}, ${LON + delta}, ${LAT + delta}, 4326),
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    
    const infraIdValue = infraId[0].id;
    console.log(`✅ Infrastructure: ${infraIdValue}`);
    
    // Créer 1 point
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
    
    console.log(`✅ 1 point créé: (${LAT}, ${LON})\n`);
    console.log(`📋 Infrastructure ID: ${infraIdValue}`);
    console.log(`\n💡 Maintenant utilise l'API pour créer le job:`);
    console.log(`   POST http://localhost:5000/api/jobs/process-insar`);
    console.log(`   { "infrastructureId": "${infraIdValue}" }\n`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

create();
