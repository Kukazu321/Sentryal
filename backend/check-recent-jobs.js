require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const jobs = await prisma.$queryRaw`
    SELECT id::text, status, hy3_job_id, created_at
    FROM jobs
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  console.log('\n📋 5 DERNIERS JOBS:\n');
  jobs.forEach((j, i) => {
    console.log(`${i + 1}. ${j.id}`);
    console.log(`   Status: ${j.status}`);
    console.log(`   HyP3: ${j.hy3_job_id}`);
    console.log(`   Créé: ${new Date(j.created_at).toLocaleString('fr-FR')}\n`);
  });
  
  await prisma.$disconnect();
}

check();
