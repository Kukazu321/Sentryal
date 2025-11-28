require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const job = await prisma.$queryRaw`
    SELECT 
      id,
      infrastructure_id,
      status,
      hy3_job_id,
      created_at,
      completed_at,
      hy3_product_urls
    FROM jobs
    WHERE id = '8c309bbb-9922-4920-9dad-18ce386ecd5e'
  `;
  
  console.log('\n📋 Job Details:\n');
  console.log(JSON.stringify(job[0], null, 2));
  console.log('\n');
  
  await prisma.$disconnect();
}

check();
