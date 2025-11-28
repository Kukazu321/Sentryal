// Script pour forcer le traitement d'un job
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './src/db/prisma';
import { hyP3Service } from './src/services/hyP3Service';
import { geotiffParser } from './src/services/geotiffParser';
import logger from './src/utils/logger';
import path from 'path';
import fs from 'fs/promises';

const JOB_ID = '0fb97f5a-15db-475d-be70-1bddcb32fd19';

async function main() {
  console.log(`\n🔄 Traitement forcé du job ${JOB_ID}...\n`);
  
  try {
    // 1. Récupérer le job
    const job = await prisma.job.findUnique({
      where: { id: JOB_ID }
    });
    
    if (!job) {
      throw new Error('Job non trouvé');
    }
    
    console.log(`✅ Job trouvé`);
    console.log(`   HyP3 Job ID: ${job.hy3_job_id}`);
    console.log(`   Status: ${job.status}\n`);
    
    // 2. Vérifier le status sur NASA
    console.log('🔍 Vérification du status NASA...');
    if (!job.hy3_job_id) throw new Error('HyP3 Job ID manquant');
    const status = await hyP3Service.getJobStatus(job.hy3_job_id);
    console.log(`   Status NASA: ${status.status}\n`);
    
    if (status.status !== 'SUCCEEDED') {
      throw new Error(`Job NASA n'est pas SUCCEEDED: ${status.status}`);
    }
    
    if (!status.files || status.files.length === 0) {
      throw new Error('Aucun fichier disponible');
    }
    
    console.log(`✅ ${status.files.length} fichiers disponibles\n`);
    
    // 3. Télécharger les fichiers
    const vertDispFile = status.files.find(f => f.filename.includes('_vert_disp.tif'));
    const losDispFile = status.files.find(f => f.filename.includes('_los_disp.tif'));
    
    if (!vertDispFile) {
      throw new Error('Fichier vertical displacement non trouvé');
    }
    
    const downloadDir = path.join(process.cwd(), 'tmp', 'geotiff', JOB_ID);
    await fs.mkdir(downloadDir, { recursive: true });
    
    console.log('📥 Téléchargement des GeoTIFF...');
    const vertDispPath = path.join(downloadDir, vertDispFile.filename);
    const vertDispBuffer = await hyP3Service.downloadFile(vertDispFile.url);
    await fs.writeFile(vertDispPath, vertDispBuffer);
    console.log(`   ✅ ${vertDispFile.filename} (${(vertDispBuffer.length / 1024 / 1024).toFixed(2)} MB)\n`);
    
    let losDispPath: string | null = null;
    if (losDispFile) {
      losDispPath = path.join(downloadDir, losDispFile.filename);
      const losDispBuffer = await hyP3Service.downloadFile(losDispFile.url);
      await fs.writeFile(losDispPath, losDispBuffer);
      console.log(`   ✅ ${losDispFile.filename}\n`);
    }
    
    // 4. Récupérer les points
    console.log('📍 Récupération des points...');
    const points = await prisma.$queryRaw<Array<{
      id: string;
      latitude: number;
      longitude: number;
    }>>`
      SELECT 
        id,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM points
      WHERE infrastructure_id = ${job.infrastructure_id}
    `;
    console.log(`   ✅ ${points.length} points trouvés\n`);
    
    // 5. Parser les déformations
    console.log('🔬 Parsing des déformations...');
    const deformations = await geotiffParser.parseVerticalDisplacement(
      vertDispPath,
      points,
      {
        losDisplacementPath: losDispPath || undefined
      }
    );
    console.log(`   ✅ ${deformations.length} déformations extraites\n`);
    
    // 6. Stocker en DB
    console.log('💾 Stockage en base de données...');
    await prisma.$transaction(async (tx) => {
      for (const deformation of deformations) {
        await tx.$executeRaw`
          INSERT INTO deformations (
            id,
            point_id,
            job_id,
            date,
            vertical_displacement_mm,
            los_displacement_mm,
            coherence,
            created_at
          ) VALUES (
            gen_random_uuid(),
            ${deformation.pointId},
            ${JOB_ID},
            ${deformation.date}::date,
            ${deformation.verticalDisplacementMm},
            ${deformation.losDisplacementMm},
            ${deformation.coherence},
            NOW()
          )
          ON CONFLICT (point_id, date) DO UPDATE SET
            vertical_displacement_mm = EXCLUDED.vertical_displacement_mm,
            los_displacement_mm = EXCLUDED.los_displacement_mm,
            coherence = EXCLUDED.coherence,
            updated_at = NOW()
        `;
      }
    });
    console.log(`   ✅ ${deformations.length} déformations stockées\n`);
    
    // 7. Mettre à jour le job
    console.log('✏️  Mise à jour du job...');
    await prisma.$executeRaw`
      UPDATE jobs 
      SET 
        status = 'SUCCEEDED'::job_status,
        hy3_product_urls = ${JSON.stringify(status.files)}::jsonb,
        result_files = ${JSON.stringify(status.files)}::jsonb,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${JOB_ID}
    `;
    console.log('   ✅ Job mis à jour\n');
    
    console.log('🎉 SUCCÈS ! Phase 4 validée !\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
