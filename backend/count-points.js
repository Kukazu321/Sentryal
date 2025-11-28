require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function count() {
  const count = await prisma.point.count({
    where: { infrastructure_id: 'fa68a304-cb43-4021-980d-605bff671d6d' }
  });
  console.log(`\n✅ Points dans l'infrastructure: ${count}\n`);
  await prisma.$disconnect();
}

count();
