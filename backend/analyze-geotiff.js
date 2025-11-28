// Télécharger et analyser le GeoTIFF pour comprendre pourquoi 0 déformations
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const { fromFile } = require('geotiff');

const ZIP_URL = 'https://d3gm2hf49xd6jj.cloudfront.net/dde0338e-a4fe-4c5e-befe-ad1921c21df9/S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_D8F8.zip';

async function analyze() {
  try {
    console.log('\n📥 Téléchargement du ZIP...\n');
    
    const response = await fetch(ZIP_URL);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const zipPath = path.join(__dirname, 'test.zip');
    await fs.writeFile(zipPath, buffer);
    console.log(`✅ ZIP téléchargé: ${buffer.length} bytes\n`);
    
    // Extraire
    console.log('📦 Extraction...\n');
    const zip = new AdmZip(zipPath);
    const extractDir = path.join(__dirname, 'test-extract');
    zip.extractAllTo(extractDir, true);
    
    // Trouver le GeoTIFF
    const files = await fs.readdir(extractDir, { recursive: true });
    const vertDispFile = files.find(f => f.includes('_vert_disp.tif'));
    
    if (!vertDispFile) {
      console.log('❌ Pas de fichier _vert_disp.tif trouvé\n');
      console.log('Fichiers extraits:');
      files.forEach(f => console.log(`  - ${f}`));
      return;
    }
    
    console.log(`✅ GeoTIFF trouvé: ${vertDispFile}\n`);
    
    // Analyser le GeoTIFF
    const tiffPath = path.join(extractDir, vertDispFile);
    const tiff = await fromFile(tiffPath);
    const image = await tiff.getImage();
    
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    
    console.log('📊 Métadonnées GeoTIFF:\n');
    console.log(`   Largeur: ${width} pixels`);
    console.log(`   Hauteur: ${height} pixels`);
    console.log(`   BBox: [${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}, ${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]`);
    console.log(`   Lon min: ${bbox[0].toFixed(4)}, Lon max: ${bbox[2].toFixed(4)}`);
    console.log(`   Lat min: ${bbox[1].toFixed(4)}, Lat max: ${bbox[3].toFixed(4)}\n`);
    
    // Lire les données
    console.log('📈 Analyse des valeurs...\n');
    const data = await image.readRasters({ interleave: false });
    const values = data[0];
    
    let validCount = 0;
    let noDataCount = 0;
    let nanCount = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (isNaN(val)) {
        nanCount++;
      } else if (val === -9999 || val < -100 || val > 100) {
        noDataCount++;
      } else {
        validCount++;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
    
    console.log(`   Total pixels: ${values.length}`);
    console.log(`   Valides: ${validCount} (${(validCount/values.length*100).toFixed(1)}%)`);
    console.log(`   NoData: ${noDataCount} (${(noDataCount/values.length*100).toFixed(1)}%)`);
    console.log(`   NaN: ${nanCount} (${(nanCount/values.length*100).toFixed(1)}%)`);
    
    if (validCount > 0) {
      console.log(`   Min: ${minVal.toFixed(4)} m`);
      console.log(`   Max: ${maxVal.toFixed(4)} m\n`);
    } else {
      console.log('\n❌ AUCUNE VALEUR VALIDE dans le GeoTIFF !\n');
    }
    
    // Vérifier si nos points sont dans la bbox
    console.log('🎯 Vérification des points:\n');
    const testPoint = { lat: 48.80004506362905, lon: 2.300015332570681 };
    
    const inBbox = testPoint.lon >= bbox[0] && testPoint.lon <= bbox[2] &&
                   testPoint.lat >= bbox[1] && testPoint.lat <= bbox[3];
    
    console.log(`   Point test: (${testPoint.lat}, ${testPoint.lon})`);
    console.log(`   Dans bbox: ${inBbox ? '✅ OUI' : '❌ NON'}\n`);
    
    if (!inBbox) {
      console.log('❌ PROBLÈME TROUVÉ: Les points sont HORS de la zone GeoTIFF !\n');
      console.log('💡 SOLUTION: Utiliser une infrastructure dans la zone couverte par le GeoTIFF\n');
    } else if (validCount === 0) {
      console.log('❌ PROBLÈME TROUVÉ: Le GeoTIFF ne contient QUE des NoData !\n');
      console.log('💡 SOLUTION: Choisir une autre paire de dates ou une autre zone\n');
    } else {
      console.log('✅ Les points SONT dans la bbox ET il y a des données valides\n');
      console.log('⚠️  Le problème est ailleurs (bug dans le parser ?)\n');
    }
    
    // Cleanup
    await fs.rm(zipPath);
    await fs.rm(extractDir, { recursive: true });
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

analyze();
