require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const jobId = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71';
  
  const deformations = await prisma.$queryRaw`
    SELECT 
      point_id::text,
      date,
      displacement_mm,
      created_at
    FROM deformations
    WHERE job_id::text = ${jobId}
    ORDER BY point_id, created_at
  `;
  
  console.log('\n📊 DÉFORMATIONS DU JOB:\n');
  console.log(`Total: ${deformations.length} déformations\n`);
  
  deformations.forEach((d, i) => {
    console.log(`${i + 1}. Point ${d.point_id.substring(0, 8)}...`);
    console.log(`   Déplacement: ${Number(d.displacement_mm).toFixed(2)} mm`);
    console.log(`   Date: ${new Date(d.date).toLocaleDateString('fr-FR')}`);
    console.log(`   Créé: ${new Date(d.created_at).toLocaleString('fr-FR')}\n`);
  });
  
  await prisma.$disconnect();
}

check();
