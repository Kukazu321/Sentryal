// Créer une infrastructure DANS la zone du GeoTIFF pour tester immédiatement
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const proj4 = require('proj4');

const prisma = new PrismaClient();
const USER_ID = '3cfdec71-668c-4af6-8bd8-4671ecfba909';

async function create() {
  try {
    console.log('\n🎯 Création infrastructure DANS la zone GeoTIFF...\n');
    
    // Le GeoTIFF couvre : [356240, 5312480, 647680, 5540240] en UTM zone 31N
    // Convertissons le centre en lat/lon
    const centerUTM = [
      (356240 + 647680) / 2,  // X center
      (5312480 + 5540240) / 2  // Y center
    ];
    
    const utmProj = '+proj=utm +zone=31 +north +datum=WGS84 +units=m +no_defs';
    const [centerLon, centerLat] = proj4(utmProj, 'EPSG:4326', centerUTM);
    
    console.log(`📍 Centre du GeoTIFF:`);
    console.log(`   UTM: (${centerUTM[0].toFixed(0)}, ${centerUTM[1].toFixed(0)})`);
    console.log(`   Lat/Lon: (${centerLat.toFixed(6)}, ${centerLon.toFixed(6)})\n`);
    
    // Créer une petite bbox autour du centre
    const bboxSize = 0.01; // ~1km
    const bbox = [
      centerLon - bboxSize,
      centerLat - bboxSize,
      centerLon + bboxSize,
      centerLat + bboxSize
    ];
    
    // Créer l'infrastructure
    const infra = await prisma.$queryRaw`
      INSERT INTO infrastructures (id, user_id, name, type, bbox, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${USER_ID}::uuid,
        'Test Zone GeoTIFF',
        'BRIDGE',
        ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326),
        NOW(),
        NOW()
      )
      RETURNING id, name
    `;
    
    const infraId = infra[0].id;
    console.log(`✅ Infrastructure créée: ${infraId}\n`);
    
    // Créer 5 points au centre
    console.log('📍 Création de 5 points...\n');
    
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 0.001; // Points espacés de ~100m
      const pointLat = centerLat + offset;
      const pointLon = centerLon + offset;
      
      await prisma.$queryRaw`
        INSERT INTO points (id, infrastructure_id, geom, created_at)
        VALUES (
          gen_random_uuid(),
          ${infraId}::uuid,
          ST_SetSRID(ST_MakePoint(${pointLon}, ${pointLat}), 4326),
          NOW()
        )
      `;
      
      console.log(`   Point ${i + 1}: (${pointLat.toFixed(6)}, ${pointLon.toFixed(6)})`);
    }
    
    console.log(`\n✅ Infrastructure prête !\n`);
    console.log(`📋 Infos:`);
    console.log(`   ID: ${infraId}`);
    console.log(`   Points: 5`);
    console.log(`   Zone: Centre du GeoTIFF\n`);
    
    console.log(`🚀 Prochaine étape:`);
    console.log(`   1. Utilise le GeoTIFF DÉJÀ téléchargé`);
    console.log(`   2. Parse avec cette nouvelle infrastructure`);
    console.log(`   3. Résultat en 30 secondes !\n`);
    
    console.log(`💾 Sauvegarde de l'ID...\n`);
    require('fs').writeFileSync('test-infra-id.txt', infraId);
    console.log(`✅ ID sauvegardé dans test-infra-id.txt\n`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

create();
