// Test du parsing GeoTIFF
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const AdmZip = require('adm-zip');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

const JOB_ID = '0fb97f5a-15db-475d-be70-1bddcb32fd19';
const INFRA_ID = 'fa68a304-cb43-4021-980d-605bff671d6d';
const ZIP_URL = 'https://hyp3-download.asf.alaska.edu/2024-11-08/8ed6b288-e55c-4d56-bdaf-1095a7ad8fab/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_9F88.zip';

async function test() {
  try {
    console.log('\n🧪 Test du parsing GeoTIFF\n');
    
    // 1. Télécharger le ZIP
    console.log('📥 Téléchargement du ZIP...');
    const response = await fetch(ZIP_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.EARTHDATA_BEARER_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`✅ ZIP téléchargé: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
    
    // 2. Extraire
    const downloadDir = path.join(process.cwd(), 'tmp', 'test-geotiff');
    await fs.mkdir(downloadDir, { recursive: true });
    
    const zipPath = path.join(downloadDir, 'test.zip');
    await fs.writeFile(zipPath, zipBuffer);
    
    console.log('📦 Extraction du ZIP...');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(downloadDir, true);
    console.log('✅ ZIP extrait\n');
    
    // 3. Lister les fichiers
    const files = await fs.readdir(downloadDir, { recursive: true });
    console.log('📁 Fichiers extraits:');
    files.forEach(f => console.log(`   - ${f}`));
    
    const vertDispFile = files.find(f => f.includes('_vert_disp.tif'));
    console.log(`\n✅ Fichier vertical displacement: ${vertDispFile || 'NON TROUVÉ'}\n`);
    
    if (!vertDispFile) {
      console.log('❌ Pas de fichier _vert_disp.tif trouvé !');
      console.log('   Le ZIP ne contient peut-être pas de displacement vertical.');
      console.log('   Vérifiez les options du job HyP3.');
      return;
    }
    
    // 4. Récupérer les points
    console.log('📍 Récupération des points...');
    const points = await prisma.$queryRaw`
      SELECT 
        id,
        ST_Y(geom::geometry) as latitude,
        ST_X(geom::geometry) as longitude
      FROM points
      WHERE infrastructure_id = ${INFRA_ID}
    `;
    console.log(`✅ ${points.length} points trouvés\n`);
    
    if (points.length === 0) {
      console.log('❌ Aucun point trouvé pour cette infrastructure !');
      return;
    }
    
    console.log('Exemple de point:');
    console.log(`   ID: ${points[0].id}`);
    console.log(`   Lat: ${points[0].latitude}`);
    console.log(`   Lon: ${points[0].longitude}\n`);
    
    // 5. Parser le GeoTIFF
    console.log('🔬 Parsing du GeoTIFF...');
    const { geotiffParser } = require('./dist/services/geotiffParser');
    
    const vertDispPath = path.join(downloadDir, vertDispFile);
    const deformations = await geotiffParser.parseVerticalDisplacement(
      vertDispPath,
      points,
      {}
    );
    
    console.log(`✅ ${deformations.length} déformations extraites\n`);
    
    if (deformations.length === 0) {
      console.log('❌ 0 déformations extraites !');
      console.log('   Problème possible:');
      console.log('   - Les points sont hors de la zone couverte par le GeoTIFF');
      console.log('   - Le GeoTIFF est vide ou corrompu');
      console.log('   - Erreur dans le parsing');
    } else {
      console.log('Exemple de déformation:');
      const d = deformations[0];
      console.log(`   Point ID: ${d.pointId.substring(0, 8)}...`);
      console.log(`   Date: ${d.date}`);
      console.log(`   Vertical: ${d.verticalDisplacementMm} mm`);
      console.log(`   Cohérence: ${d.coherence}`);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
