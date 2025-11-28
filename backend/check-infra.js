require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function check() {
  const infraId = fs.readFileSync('test-infra-id.txt', 'utf8').trim();
  
  const points = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM points 
    WHERE infrastructure_id::text = ${infraId}
  `;
  
  const sample = await prisma.$queryRaw`
    SELECT ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon
    FROM points 
    WHERE infrastructure_id::text = ${infraId}
    LIMIT 1
  `;
  
  console.log('   ✅ Points:', points[0].count);
  console.log('   ✅ Premier point:', `(${sample[0].lat.toFixed(6)}, ${sample[0].lon.toFixed(6)})`);
  
  await prisma.$disconnect();
}

check();
