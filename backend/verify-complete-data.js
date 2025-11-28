require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const jobId = '8857825a-f0f9-41f5-9ebd-8cfa4bdbad71';
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 VÉRIFICATION COMPLÈTE DES DONNÉES\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Job
  console.log('1️⃣ JOB:\n');
  const job = await prisma.$queryRaw`
    SELECT 
      id::text,
      infrastructure_id::text,
      status,
      hy3_job_id,
      created_at,
      completed_at
    FROM jobs
    WHERE id::text = ${jobId}
  `;
  
  console.log('   ID:', job[0].id);
  console.log('   Status:', job[0].status);
  console.log('   HyP3 Job ID:', job[0].hy3_job_id);
  console.log('   Infrastructure ID:', job[0].infrastructure_id);
  console.log('   Créé:', new Date(job[0].created_at).toLocaleString('fr-FR'));
  console.log('   Complété:', job[0].completed_at ? new Date(job[0].completed_at).toLocaleString('fr-FR') : 'null');
  console.log('');
  
  // 2. Infrastructure
  console.log('2️⃣ INFRASTRUCTURE:\n');
  const infra = await prisma.$queryRaw`
    SELECT 
      id::text,
      name,
      user_id::text,
      created_at
    FROM infrastructures
    WHERE id::text = ${job[0].infrastructure_id}
  `;
  
  console.log('   ID:', infra[0].id);
  console.log('   Nom:', infra[0].name);
  console.log('   User ID:', infra[0].user_id);
  console.log('   Créée:', new Date(infra[0].created_at).toLocaleString('fr-FR'));
  console.log('');
  
  // 3. Points
  console.log('3️⃣ POINTS:\n');
  const points = await prisma.$queryRaw`
    SELECT 
      id::text,
      ST_Y(geom::geometry) as latitude,
      ST_X(geom::geometry) as longitude,
      created_at
    FROM points
    WHERE infrastructure_id::text = ${job[0].infrastructure_id}
    ORDER BY created_at
  `;
  
  console.log(`   Total: ${points.length} points\n`);
  points.forEach((p, i) => {
    console.log(`   ${i + 1}. Point ${i+1}`);
    console.log(`      ID: ${p.id}`);
    console.log(`      Coordonnées: (${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)})`);
    console.log('');
  });
  
  // 4. Déformations
  console.log('4️⃣ DÉFORMATIONS:\n');
  const deformations = await prisma.$queryRaw`
    SELECT 
      d.id::text,
      d.point_id::text,
      d.job_id::text,
      d.date,
      d.displacement_mm,
      d.coherence,
      d.velocity_mm_year,
      d.created_at,
      ST_Y(p.geom::geometry) as latitude,
      ST_X(p.geom::geometry) as longitude
    FROM deformations d
    JOIN points p ON d.point_id = p.id
    WHERE d.job_id::text = ${jobId}
    ORDER BY d.displacement_mm
  `;
  
  console.log(`   Total: ${deformations.length} déformations\n`);
  
  if (deformations.length > 0) {
    deformations.forEach((d, i) => {
      console.log(`   ${i + 1}. Point (${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)})`);
      console.log(`      ID: ${d.id}`);
      console.log(`      Déplacement: ${Number(d.displacement_mm).toFixed(2)} mm`);
      console.log(`      Cohérence: ${d.coherence ? Number(d.coherence).toFixed(2) : 'null'}`);
      console.log(`      Vélocité: ${d.velocity_mm_year ? Number(d.velocity_mm_year).toFixed(2) + ' mm/an' : 'null'}`);
      console.log(`      Date: ${new Date(d.date).toLocaleDateString('fr-FR')}`);
      console.log(`      Créée: ${new Date(d.created_at).toLocaleString('fr-FR')}`);
      console.log('');
    });
  }
  
  // 5. Statistiques
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STATISTIQUES:\n');
  
  const stats = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as count,
      AVG(displacement_mm)::float as avg_displacement,
      MIN(displacement_mm)::float as min_displacement,
      MAX(displacement_mm)::float as max_displacement,
      AVG(coherence)::float as avg_coherence
    FROM deformations
    WHERE job_id::text = ${jobId}
  `;
  
  if (stats[0].count > 0) {
    console.log(`   Nombre de déformations: ${stats[0].count}`);
    console.log(`   Déplacement moyen: ${stats[0].avg_displacement.toFixed(2)} mm`);
    console.log(`   Déplacement min: ${stats[0].min_displacement.toFixed(2)} mm`);
    console.log(`   Déplacement max: ${stats[0].max_displacement.toFixed(2)} mm`);
    console.log(`   Cohérence moyenne: ${stats[0].avg_coherence ? stats[0].avg_coherence.toFixed(2) : 'N/A'}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Vérification de l'intégrité
  let allGood = true;
  
  if (job[0].status !== 'SUCCEEDED') {
    console.log('❌ Job status n\'est pas SUCCEEDED');
    allGood = false;
  }
  
  if (!job[0].hy3_job_id) {
    console.log('❌ HyP3 Job ID manquant');
    allGood = false;
  }
  
  if (points.length === 0) {
    console.log('❌ Aucun point trouvé');
    allGood = false;
  }
  
  if (deformations.length === 0) {
    console.log('❌ Aucune déformation trouvée');
    allGood = false;
  }
  
  if (deformations.length !== points.length) {
    console.log(`⚠️  Nombre de déformations (${deformations.length}) ≠ nombre de points (${points.length})`);
  }
  
  if (allGood && deformations.length === points.length) {
    console.log('✅ TOUTES LES DONNÉES SONT COMPLÈTES ET COHÉRENTES !\n');
    console.log('🎉 PIPELINE InSAR 100% FONCTIONNEL !\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await prisma.$disconnect();
}

verify();
