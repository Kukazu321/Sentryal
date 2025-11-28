require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const jobs = await prisma.$queryRaw`
    SELECT id::text, status, created_at
    FROM jobs
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const j = jobs[0];
  
  const d = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM deformations
    WHERE job_id::text = ${j.id}
  `;
  
  console.log('   Dernier job:', j.id.substring(0, 8) + '...');
  console.log('   Status:', j.status);
  console.log('   Déformations:', d[0].count);
  console.log('');
  
  if (j.status === 'SUCCEEDED' && d[0].count > 0) {
    console.log('   ✅ Worker a parsé et inséré automatiquement !');
  } else {
    console.log('   ⚠️  Worker n\'a pas encore traité ce job');
  }
  console.log('');
  
  await prisma.$disconnect();
}

check();
