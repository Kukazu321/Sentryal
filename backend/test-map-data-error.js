const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INFRA_ID = '58335d08-1897-41c1-a1b1-9e7dbbda4f61';

async function testMapData() {
  try {
    console.log('🔍 Testing map-data query for infrastructure:', INFRA_ID);
    
    // Check if infrastructure exists
    const infra = await prisma.infrastructure.findUnique({
      where: { id: INFRA_ID }
    });
    
    if (!infra) {
      console.error('❌ Infrastructure not found');
      await prisma.$disconnect();
      process.exit(1);
    }
    
    console.log('✅ Infrastructure found:', infra.name);
    
    // Check points count
    const pointsCount = await prisma.point.count({
      where: { infrastructure_id: INFRA_ID }
    });
    
    console.log('📊 Points count:', pointsCount);
    
    // Test the actual query from mapDataService
    const totalCountRows = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count
      FROM points p
      WHERE p.infrastructure_id::text = ${INFRA_ID}
    `;
    
    const totalPoints = Number(totalCountRows?.[0]?.count || 0);
    console.log('📊 Total points (from query):', totalPoints);
    
    // Test the main query
    const pointsData = await prisma.$queryRaw`
      SELECT 
        p.id::text as point_id,
        ST_X(p.geom) as longitude,
        ST_Y(p.geom) as latitude,
        latest.displacement_mm::text as latest_displacement_mm,
        latest.velocity_mm_year::text as latest_velocity_mm_year,
        latest.coherence::text as latest_coherence,
        latest.date as latest_date,
        COALESCE(stats.measurement_count, 0) as measurement_count,
        stats.min_displacement_mm::text as min_displacement_mm,
        stats.max_displacement_mm::text as max_displacement_mm,
        stats.avg_coherence::text as avg_coherence,
        stats.earliest_date
      FROM points p
      LEFT JOIN LATERAL (
        SELECT 
          displacement_mm,
          velocity_mm_year,
          coherence,
          date
        FROM deformations
        WHERE point_id = p.id
        ORDER BY date DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::bigint as measurement_count,
          MIN(displacement_mm) as min_displacement_mm,
          MAX(displacement_mm) as max_displacement_mm,
          AVG(coherence) as avg_coherence,
          MIN(date) as earliest_date
        FROM deformations
        WHERE point_id = p.id
      ) stats ON true
      WHERE p.infrastructure_id::text = ${INFRA_ID}
      ORDER BY p.created_at
      LIMIT 10
    `;
    
    console.log('✅ Query executed successfully');
    console.log('📊 Sample points:', pointsData.length);
    
    // Helper function to convert BigInt to Number
    const convertBigInt = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (Array.isArray(obj)) return obj.map(convertBigInt);
      if (typeof obj === 'object' && obj.constructor === Object) {
        const converted = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            converted[key] = convertBigInt(obj[key]);
          }
        }
        return converted;
      }
      return obj;
    };
    
    if (pointsData.length > 0) {
      const converted = convertBigInt(pointsData[0]);
      console.log('📋 First point sample:', JSON.stringify(converted, null, 2));
    }
    
    await prisma.$disconnect();
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testMapData();

