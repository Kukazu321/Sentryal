require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { fromFile } = require('geotiff');
const proj4 = require('proj4');

const prisma = new PrismaClient();
const JOB_ID = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71';
const INFRA_ID = '16a94217-48f4-4283-a4cc-fb8bcb7084b1';
const GEOTIFF_PATH = 'tmp/geotiff/8857825a-f0f9-41f5-9ebd-8cfa4bdbad71/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_34EF/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_34EF_vert_disp.tif';

async function parseNow() {
  console.log('\n🔥 PARSING MANUEL IMMÉDIAT\n');
  
  // Récupérer les points
  const points = await prisma.$queryRaw`
    SELECT 
      id::text,
      ST_Y(geom::geometry) as latitude,
      ST_X(geom::geometry) as longitude
    FROM points
    WHERE infrastructure_id::text = ${INFRA_ID}
  `;
  
  console.log(`📍 Points: ${points.length}\n`);
  
  // Parser le GeoTIFF
  const tiff = await fromFile(GEOTIFF_PATH);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const data = await image.readRasters({ interleave: false });
  const values = data[0];
  
  console.log(`📊 GeoTIFF: ${width}x${height}`);
  console.log(`📦 BBox: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]\n`);
  
  // Date du GeoTIFF
  const acquisitionDate = new Date('2024-11-25');
  
  let insertedCount = 0;
  
  for (const point of points) {
    const lat = point.latitude;
    const lon = point.longitude;
    
    // Conversion UTM
    const utmZone = Math.floor((lon + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'north' : 'south';
    const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
    const [projX, projY] = proj4('EPSG:4326', utmProj, [lon, lat]);
    
    // Pixel coordinates
    const normalizedX = (projX - bbox[0]) / (bbox[2] - bbox[0]);
    const normalizedY = (bbox[3] - projY) / (bbox[3] - bbox[1]);
    const pixelX = Math.floor(normalizedX * width);
    const pixelY = Math.floor(normalizedY * height);
    
    if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
      const index = pixelY * width + pixelX;
      const valueM = values[index];
      const valueMm = valueM * 1000;
      
      if (!isNaN(valueM) && valueM !== -9999 && valueM > -100 && valueM < 100) {
        // Insérer en DB
        await prisma.$executeRaw`
          INSERT INTO deformations (
            id, point_id, job_id, date,
            displacement_mm, coherence, created_at
          ) VALUES (
            gen_random_uuid(),
            ${point.id}::uuid,
            ${JOB_ID}::uuid,
            ${acquisitionDate},
            ${valueMm},
            1.0,
            NOW()
          )
          ON CONFLICT (point_id, job_id, date) DO UPDATE SET
            displacement_mm = ${valueMm}
        `;
        
        console.log(`✅ Point ${point.id.substring(0, 8)}... : ${valueMm.toFixed(2)} mm`);
        insertedCount++;
      }
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`🎉 ${insertedCount} DÉFORMATIONS INSÉRÉES !`);
  console.log(`✅ JOB ${JOB_ID} COMPLÉTÉ MANUELLEMENT\n`);
  
  await prisma.$disconnect();
}

parseNow().catch(console.error);
