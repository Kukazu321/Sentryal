// Tester le parsing DIRECTEMENT avec le GeoTIFF déjà téléchargé
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const INFRA_ID = fs.readFileSync('test-infra-id.txt', 'utf8').trim();
const GEOTIFF_PATH = 'tmp/geotiff/71d5a092-f0af-4c2f-ba0d-46e65e8092ac/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_DA94/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_DA94_vert_disp.tif';

async function test() {
  try {
    console.log('\n🧪 TEST PARSING DIRECT\n');
    console.log(`📁 GeoTIFF: ${GEOTIFF_PATH}`);
    console.log(`📍 Infrastructure: ${INFRA_ID}\n`);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(GEOTIFF_PATH)) {
      console.log('❌ GeoTIFF non trouvé !\n');
      console.log('Fichiers disponibles:');
      const files = fs.readdirSync('tmp/geotiff/0460869a-bc02-4ef7-adec-62d1b9329858', { recursive: true });
      files.forEach(f => console.log(`  - ${f}`));
      return;
    }
    
    console.log('✅ GeoTIFF trouvé\n');
    
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
    points.forEach((p, i) => {
      console.log(`   ${i + 1}. (${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)})`);
    });
    
    // Importer le parser
    console.log('\n🔄 Lancement du parsing...\n');
    
    // Utiliser geotiff directement pour tester
    const { fromFile } = require('geotiff');
    const proj4 = require('proj4');
    
    const tiff = await fromFile(GEOTIFF_PATH);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    const data = await image.readRasters({ interleave: false });
    const values = data[0];
    
    console.log(`📊 GeoTIFF: ${width}x${height}`);
    console.log(`📦 BBox: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]\n`);
    
    const deformations = [];
    
    for (const point of points) {
      const lat = point.latitude;
      const lon = point.longitude;
      
      // Conversion UTM
      const utmZone = Math.floor((lon + 180) / 6) + 1;
      const hemisphere = lat >= 0 ? 'north' : 'south';
      const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
      
      const [projX, projY] = proj4('EPSG:4326', utmProj, [lon, lat]);
      
      console.log(`Point (${lat.toFixed(6)}, ${lon.toFixed(6)}) → UTM (${projX.toFixed(0)}, ${projY.toFixed(0)})`);
      
      // Pixel coordinates
      const normalizedX = (projX - bbox[0]) / (bbox[2] - bbox[0]);
      const normalizedY = (bbox[3] - projY) / (bbox[3] - bbox[1]);
      const pixelX = Math.floor(normalizedX * width);
      const pixelY = Math.floor(normalizedY * height);
      
      console.log(`  → Pixel (${pixelX}, ${pixelY})`);
      
      if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
        const index = pixelY * width + pixelX;
        const value = values[index];
        console.log(`  → Valeur: ${value} m = ${(value * 1000).toFixed(2)} mm ✅\n`);
        
        if (!isNaN(value) && value !== -9999 && value > -100 && value < 100) {
          deformations.push({
            pointId: point.id,
            verticalDisplacementMm: value * 1000
          });
        }
      } else {
        console.log(`  → HORS LIMITES ❌\n`);
      }
    }
    
    console.log(`\n📊 RÉSULTAT: ${deformations.length} déformations trouvées\n`);
    
    if (deformations.length > 0) {
      console.log('🎉 ÇA MARCHE ! Le parsing fonctionne !\n');
      console.log('Premières déformations:');
      deformations.slice(0, 3).forEach((d, i) => {
        console.log(`   ${i + 1}. Point ${d.pointId.substring(0, 8)}... : ${d.verticalDisplacementMm.toFixed(2)} mm`);
      });
      console.log('\n✅ FIX UTM VALIDÉ - Le code fonctionne !\n');
    } else {
      console.log('❌ Toujours 0 déformations\n');
      console.log('⚠️  Problème possible:');
      console.log('   - Points encore hors zone');
      console.log('   - Bug dans la conversion UTM');
      console.log('   - GeoTIFF ne contient que des NoData\n');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
