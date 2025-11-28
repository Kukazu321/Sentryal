// Tester le fix UTM avec le GeoTIFF déjà téléchargé
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const { fromFile } = require('geotiff');
const proj4 = require('proj4');

const prisma = new PrismaClient();
const ZIP_URL = 'https://d3gm2hf49xd6jj.cloudfront.net/dde0338e-a4fe-4c5e-befe-ad1921c21df9/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_D8F8.zip';
const INFRA_ID = 'fa68a304-cb43-4021-980d-605bff671d6d';

async function test() {
  try {
    console.log('\n🧪 TEST DU FIX UTM\n');
    
    // 1. Télécharger et extraire
    console.log('📥 Téléchargement ZIP...');
    const response = await fetch(ZIP_URL);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const zipPath = path.join(__dirname, 'test-fix.zip');
    await fs.writeFile(zipPath, buffer);
    
    const zip = new AdmZip(zipPath);
    const extractDir = path.join(__dirname, 'test-fix-extract');
    zip.extractAllTo(extractDir, true);
    
    const files = await fs.readdir(extractDir, { recursive: true });
    const vertDispFile = files.find(f => f.includes('_vert_disp.tif'));
    const tiffPath = path.join(extractDir, vertDispFile);
    
    console.log(`✅ GeoTIFF: ${vertDispFile}\n`);
    
    // 2. Lire métadonnées
    const tiff = await fromFile(tiffPath);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    
    console.log('📊 GeoTIFF Metadata:');
    console.log(`   BBox: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`);
    console.log(`   Size: ${width}x${height}\n`);
    
    // 3. Récupérer quelques points
    const points = await prisma.$queryRaw`
      SELECT 
        id,
        ST_Y(geom::geometry) as latitude,
        ST_X(geom::geometry) as longitude
      FROM points
      WHERE infrastructure_id = ${INFRA_ID}
      LIMIT 5
    `;
    
    console.log(`📍 Points à tester: ${points.length}\n`);
    
    // 4. Tester la conversion UTM
    let successCount = 0;
    
    for (const point of points) {
      const lat = point.latitude;
      const lon = point.longitude;
      
      // AVANT (sans conversion) - FAUX
      const oldX = lon;
      const oldY = lat;
      const oldInBbox = oldX >= bbox[0] && oldX <= bbox[2] && oldY >= bbox[1] && oldY <= bbox[3];
      
      // APRÈS (avec conversion UTM) - CORRECT
      const utmZone = Math.floor((lon + 180) / 6) + 1;
      const hemisphere = lat >= 0 ? 'north' : 'south';
      const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
      
      const [projX, projY] = proj4('EPSG:4326', utmProj, [lon, lat]);
      const newInBbox = projX >= bbox[0] && projX <= bbox[2] && projY >= bbox[1] && projY <= bbox[3];
      
      console.log(`Point ${point.id.substring(0, 8)}...`);
      console.log(`  Lat/Lon: (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      console.log(`  UTM: (${projX.toFixed(0)}, ${projY.toFixed(0)})`);
      console.log(`  AVANT (lat/lon direct): ${oldInBbox ? '✅ Dans bbox' : '❌ Hors bbox'}`);
      console.log(`  APRÈS (UTM converti): ${newInBbox ? '✅ Dans bbox' : '❌ Hors bbox'}\n`);
      
      if (newInBbox) successCount++;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (successCount > 0) {
      console.log(`🎉 FIX FONCTIONNE ! ${successCount}/${points.length} points dans la bbox\n`);
      console.log('✅ Le parsing devrait maintenant trouver des déformations\n');
      console.log('💡 Tu peux lancer un nouveau job en toute confiance !\n');
    } else {
      console.log('❌ Aucun point dans la bbox même avec conversion UTM\n');
      console.log('⚠️  Les points sont vraiment hors de la zone couverte\n');
    }
    
    // Cleanup
    await fs.rm(zipPath);
    await fs.rm(extractDir, { recursive: true });
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
