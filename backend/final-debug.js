// DEBUG FINAL - Pourquoi 0 déformations ?
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  try {
    console.log('\n🔍 DEBUG FINAL - Analyse complète\n');
    
    // 1. Dernier job
    const job = await prisma.$queryRaw`
      SELECT id, infrastructure_id, hy3_job_id, status, completed_at
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    console.log('📋 Dernier job:');
    console.log(`   ID: ${job[0].id}`);
    console.log(`   Status: ${job[0].status}`);
    console.log(`   HyP3 ID: ${job[0].hy3_job_id || 'NULL'}`);
    console.log(`   Infrastructure: ${job[0].infrastructure_id}\n`);
    
    // 2. Points de l'infrastructure
    const points = await prisma.$queryRaw`
      SELECT 
        id,
        ST_Y(geom::geometry) as lat,
        ST_X(geom::geometry) as lon
      FROM points
      WHERE infrastructure_id = ${job[0].infrastructure_id}
    `;
    
    console.log(`📍 Points: ${points.length}`);
    if (points.length > 0) {
      console.log(`   Premier point: (${points[0].lat}, ${points[0].lon})\n`);
    }
    
    // 3. Déformations
    const deformations = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM deformations d
      JOIN points p ON d.point_id = p.id
      WHERE p.infrastructure_id = ${job[0].infrastructure_id}
    `;
    
    console.log(`📊 Déformations: ${deformations[0].count}\n`);
    
    // 4. Diagnostic
    console.log('🔬 DIAGNOSTIC:\n');
    
    if (!job[0].hy3_job_id) {
      console.log('❌ PROBLÈME: HyP3 Job ID est NULL');
      console.log('   → Le worker n\'a PAS créé de job NASA');
      console.log('   → Soit pas d\'images Sentinel-1 trouvées');
      console.log('   → Soit erreur dans granuleSearchService\n');
    } else if (job[0].status === 'PENDING' || job[0].status === 'RUNNING') {
      console.log(`⏳ EN COURS: Job status = ${job[0].status}`);
      console.log('   → NASA est en train de traiter le job');
      console.log('   → Attendre 25-40 minutes au total');
      console.log('   → Revérifier dans quelques minutes\n');
    } else if (job[0].status === 'FAILED') {
      console.log('❌ PROBLÈME: Job a échoué');
      console.log('   → Vérifier les logs du worker\n');
    } else if (job[0].status !== 'SUCCEEDED') {
      console.log(`⚠️  Status inattendu: ${job[0].status}\n`);
    } else if (points.length === 0) {
      console.log('❌ PROBLÈME: 0 points dans l\'infrastructure');
      console.log('   → Impossible de parser sans points\n');
    } else if (deformations[0].count === 0) {
      console.log('❌ PROBLÈME: Parsing a retourné 0 résultats');
      console.log('   → Les points sont probablement HORS de la zone GeoTIFF');
      console.log('   → Ou le GeoTIFF ne contient que des NoData\n');
      
      console.log('💡 SOLUTIONS:');
      console.log('   1. Vérifier que les coordonnées des points sont correctes');
      console.log('   2. Vérifier que la bbox de l\'infrastructure couvre les points');
      console.log('   3. Télécharger le GeoTIFF manuellement et vérifier son contenu');
      console.log('   4. Ajouter des logs dans geotiffParser.ts pour voir les valeurs extraites\n');
    } else {
      console.log('✅ TOUT EST OK !');
      console.log(`   ${deformations[0].count} déformations trouvées\n`);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
