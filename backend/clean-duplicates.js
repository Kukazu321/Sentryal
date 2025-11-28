require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('\n🧹 NETTOYAGE DES DOUBLONS\n');
  
  // Trouver les doublons (même point_id, job_id, date)
  const duplicates = await prisma.$queryRaw`
    SELECT 
      point_id,
      job_id,
      date,
      COUNT(*) as count,
      ARRAY_AGG(id::text ORDER BY created_at) as ids
    FROM deformations
    GROUP BY point_id, job_id, date
    HAVING COUNT(*) > 1
  `;
  
  console.log(`📊 Doublons trouvés: ${duplicates.length} groupes\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ Aucun doublon à nettoyer\n');
    await prisma.$disconnect();
    return;
  }
  
  let deletedCount = 0;
  
  for (const dup of duplicates) {
    const idsToKeep = [dup.ids[0]]; // Garder le premier (le plus ancien)
    const idsToDelete = dup.ids.slice(1); // Supprimer les autres
    
    console.log(`Point ${dup.point_id.substring(0, 8)}... - Date ${new Date(dup.date).toLocaleDateString('fr-FR')}`);
    console.log(`  Garder: ${idsToKeep[0].substring(0, 8)}...`);
    console.log(`  Supprimer: ${idsToDelete.length} doublon(s)`);
    
    for (const id of idsToDelete) {
      await prisma.$executeRaw`
        DELETE FROM deformations WHERE id::text = ${id}
      `;
      deletedCount++;
    }
  }
  
  console.log(`\n✅ ${deletedCount} doublons supprimés\n`);
  
  await prisma.$disconnect();
}

cleanDuplicates();
