require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getUserId() {
  const infra = await prisma.infrastructure.findFirst({
    select: { user_id: true }
  });
  console.log(`\nUser ID: ${infra.user_id}\n`);
  await prisma.$disconnect();
}

getUserId();
