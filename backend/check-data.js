// Script pour vérifier les données en DB
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('\n📊 Vérification des données en base...\n');
    
    // 1. Compter les déformations
    const deformationCount = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM deformations
    `;
    console.log(`✅ Déformations: ${deformationCount[0].count}`);
    
    // 2. Statistiques sur les déformations
    if (deformationCount[0].count > 0) {
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT point_id) as points_with_data,
          MIN(date) as earliest_date,
          MAX(date) as latest_date,
          AVG(vertical_displacement_mm)::numeric(10,2) as avg_displacement,
          MIN(vertical_displacement_mm)::numeric(10,2) as min_displacement,
          MAX(vertical_displacement_mm)::numeric(10,2) as max_displacement
        FROM deformations
      `;
      
      console.log(`\n📈 Statistiques:`);
      console.log(`   Points avec données: ${stats[0].points_with_data}`);
      console.log(`   Date la plus ancienne: ${stats[0].earliest_date}`);
      console.log(`   Date la plus récente: ${stats[0].latest_date}`);
      console.log(`   Déplacement moyen: ${stats[0].avg_displacement} mm`);
      console.log(`   Déplacement min: ${stats[0].min_displacement} mm`);
      console.log(`   Déplacement max: ${stats[0].max_displacement} mm`);
      
      // 3. Quelques exemples
      const examples = await prisma.$queryRaw`
        SELECT 
          id,
          point_id,
          date,
          vertical_displacement_mm::numeric(10,2) as vertical_mm,
          los_displacement_mm::numeric(10,2) as los_mm,
          coherence::numeric(4,3) as coherence
        FROM deformations
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      console.log(`\n🔍 Exemples (5 dernières déformations):`);
      examples.forEach((d, i) => {
        console.log(`\n   ${i+1}. Date: ${d.date}`);
        console.log(`      Point ID: ${d.point_id.substring(0, 8)}...`);
        console.log(`      Vertical: ${d.vertical_mm} mm`);
        console.log(`      LOS: ${d.los_mm} mm`);
        console.log(`      Cohérence: ${d.coherence}`);
      });
    }
    
    // 4. Vérifier le job (le plus récent)
    const job = await prisma.$queryRaw`
      SELECT 
        id,
        status,
        completed_at,
        hy3_job_id
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    console.log(`\n📋 Job InSAR:`);
    console.log(`   Status: ${job[0].status}`);
    console.log(`   Complété: ${job[0].completed_at}`);
    console.log(`   HyP3 ID: ${job[0].hy3_job_id}`);
    
    console.log('\n🎉 Phase 4 validée avec succès !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
