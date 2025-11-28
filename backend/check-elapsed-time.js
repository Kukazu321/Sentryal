require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const job = await prisma.$queryRaw`
    SELECT created_at 
    FROM jobs 
    WHERE id = '71d5a092-f0af-4c2f-ba0d-46e65e8092ac'
  `;
  
  const created = new Date(job[0].created_at);
  const now = new Date();
  const elapsedMs = now - created;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  
  console.log('\n⏰ TEMPS ÉCOULÉ\n');
  console.log(`Job créé: ${created.toLocaleString('fr-FR')}`);
  console.log(`Maintenant: ${now.toLocaleString('fr-FR')}`);
  console.log(`\n⏱️  Temps écoulé: ${elapsedMin} minutes\n`);
  
  if (elapsedMin < 25) {
    console.log(`⏳ Encore ${30 - elapsedMin} minutes minimum avant que NASA finisse\n`);
  } else if (elapsedMin < 40) {
    console.log('⏰ NASA devrait finir dans les 10 prochaines minutes\n');
    console.log('💡 Revérifie dans 5 minutes avec: node final-debug.js\n');
  } else {
    console.log('⚠️  NASA prend plus de temps que prévu (normal parfois)\n');
    console.log('💡 Continue à vérifier toutes les 5 minutes\n');
  }
  
  await prisma.$disconnect();
}

check();
