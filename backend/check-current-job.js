require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const job = await prisma.$queryRaw`
    SELECT id, infrastructure_id, status, hy3_job_id, created_at, completed_at
    FROM jobs
    WHERE id = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71'
  `;
  
  console.log('\n📋 Job actuel:\n');
  console.log(JSON.stringify(job[0], null, 2));
  console.log('\n');
  
  await prisma.$disconnect();
}

check();
