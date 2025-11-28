const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
    try {
        // Get the job ID using raw SQL
        const jobResult = await prisma.$queryRaw`
      SELECT id, status FROM jobs 
      WHERE infrastructure_id = '270e738d-056c-49e9-abda-59dc89754676'
      ORDER BY created_at DESC
      LIMIT 1
    `;

        if (!jobResult || jobResult.length === 0) {
            console.log('No job found');
            return;
        }

        const jobId = jobResult[0].id;
        const jobStatus = jobResult[0].status;

        console.log('Job ID:', jobId);
        console.log('Job Status:', jobStatus);

        // Count deformations using raw SQL
        const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM deformations WHERE job_id = ${jobId}
    `;

        const count = Number(countResult[0].count);
        console.log(' Deformations count:', count);

        if (count > 0) {
            console.log(' SUCCESS! Deformations are in the database!');
        } else {
            console.log(' No deformations found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
