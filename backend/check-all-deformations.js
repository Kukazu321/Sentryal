require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 TOUTES LES DÉFORMATIONS EN DB:\n');
  
  const deformations = await prisma.$queryRaw`
    SELECT 
      job_id::text,
      COUNT(*)::int as count
    FROM deformations
    GROUP BY job_id
  `;
  
  if (deformations.length === 0) {
    console.log('❌ Aucune déformation dans la DB !\n');
  } else {
    console.log(`Total: ${deformations.length} job(s) avec déformations\n`);
    for (const d of deformations) {
      console.log(`Job ${d.job_id}: ${d.count} déformations`);
    }
    console.log('');
  }
  
  // Vérifier le job spécifique
  const currentJob = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71';
  const currentDef = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM deformations
    WHERE job_id::text = ${currentJob}
  `;
  
  console.log(`\nJob actuel (${currentJob}):`);
  console.log(`  Déformations: ${currentDef[0].count}\n`);
  
  await prisma.$disconnect();
}

check();
