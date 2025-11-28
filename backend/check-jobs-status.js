/**
 * Script de diagnostic pour vérifier l'état des jobs InSAR
 * Usage: node check-jobs-status.js [infrastructureId]
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJobsStatus(infrastructureId = null) {
  try {
    console.log('🔍 Checking InSAR jobs status...\n');

    // Get all jobs or jobs for specific infrastructure
    let jobs;
    if (infrastructureId) {
      jobs = await prisma.$queryRaw`
        SELECT 
          j.id,
          j.infrastructure_id,
          i.name as infrastructure_name,
          j.hy3_job_id,
          j.status,
          j.error_message,
          j.retry_count,
          j.processing_time_ms,
          j.created_at,
          j.completed_at,
          j.hy3_product_urls
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        WHERE j.infrastructure_id = ${infrastructureId}
        ORDER BY j.created_at DESC
        LIMIT 50
      `;
    } else {
      jobs = await prisma.$queryRaw`
        SELECT 
          j.id,
          j.infrastructure_id,
          i.name as infrastructure_name,
          j.hy3_job_id,
          j.status,
          j.error_message,
          j.retry_count,
          j.processing_time_ms,
          j.created_at,
          j.completed_at,
          j.hy3_product_urls
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        ORDER BY j.created_at DESC
        LIMIT 50
      `;
    }

    if (jobs.length === 0) {
      console.log('❌ No jobs found');
      return;
    }

    console.log(`📊 Found ${jobs.length} job(s)\n`);
    console.log('━'.repeat(80));

    // Group by status
    const byStatus = {
      PENDING: [],
      RUNNING: [],
      PROCESSING: [],
      SUCCEEDED: [],
      FAILED: [],
      CANCELLED: [],
    };

    jobs.forEach(job => {
      const status = job.status || 'UNKNOWN';
      if (byStatus[status]) {
        byStatus[status].push(job);
      }
    });

    // Display summary
    console.log('\n📈 Summary:');
    Object.entries(byStatus).forEach(([status, jobs]) => {
      if (jobs.length > 0) {
        const icon = status === 'SUCCEEDED' ? '✅' : 
                    status === 'FAILED' ? '❌' : 
                    status === 'CANCELLED' ? '🚫' :
                    status === 'PENDING' ? '⏳' :
                    status === 'RUNNING' || status === 'PROCESSING' ? '🔄' : '❓';
        console.log(`  ${icon} ${status}: ${jobs.length}`);
      }
    });

    // Display active jobs first
    const activeJobs = jobs.filter(j => 
      j.status === 'PENDING' || j.status === 'RUNNING' || j.status === 'PROCESSING'
    );

    if (activeJobs.length > 0) {
      console.log('\n🔄 Active Jobs:');
      console.log('━'.repeat(80));
      activeJobs.forEach((job, idx) => {
        const elapsed = job.completed_at 
          ? Math.round((new Date(job.completed_at) - new Date(job.created_at)) / 1000 / 60)
          : Math.round((Date.now() - new Date(job.created_at)) / 1000 / 60);
        
        console.log(`\n${idx + 1}. Job ID: ${job.id}`);
        console.log(`   Infrastructure: ${job.infrastructure_name || 'Unknown'} (${job.infrastructure_id})`);
        console.log(`   Status: ${job.status}`);
        console.log(`   HyP3 Job ID: ${job.hy3_job_id || 'N/A'}`);
        console.log(`   Elapsed: ${elapsed} minutes`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        if (job.error_message) {
          console.log(`   ❌ Error: ${job.error_message}`);
        }
        if (job.retry_count > 0) {
          console.log(`   Retry count: ${job.retry_count}`);
        }
      });
    }

    // Display failed jobs
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'CANCELLED');
    if (failedJobs.length > 0) {
      console.log('\n❌ Failed Jobs:');
      console.log('━'.repeat(80));
      failedJobs.forEach((job, idx) => {
        console.log(`\n${idx + 1}. Job ID: ${job.id}`);
        console.log(`   Infrastructure: ${job.infrastructure_name || 'Unknown'}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   HyP3 Job ID: ${job.hy3_job_id || 'N/A'}`);
        if (job.error_message) {
          console.log(`   ❌ Error: ${job.error_message}`);
        }
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        if (job.completed_at) {
          console.log(`   Failed at: ${new Date(job.completed_at).toLocaleString()}`);
        }
        if (job.retry_count > 0) {
          console.log(`   Retry count: ${job.retry_count}`);
        }
      });
    }

    // Display recent succeeded jobs
    const succeededJobs = jobs.filter(j => j.status === 'SUCCEEDED').slice(0, 5);
    if (succeededJobs.length > 0) {
      console.log('\n✅ Recent Completed Jobs:');
      console.log('━'.repeat(80));
      succeededJobs.forEach((job, idx) => {
        const duration = job.completed_at && job.created_at
          ? Math.round((new Date(job.completed_at) - new Date(job.created_at)) / 1000 / 60)
          : job.processing_time_ms 
            ? Math.round(job.processing_time_ms / 1000 / 60)
            : 'N/A';
        
        console.log(`\n${idx + 1}. Job ID: ${job.id}`);
        console.log(`   Infrastructure: ${job.infrastructure_name || 'Unknown'}`);
        console.log(`   Duration: ${duration} minutes`);
        console.log(`   Completed: ${job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}`);
        if (job.hy3_product_urls) {
          const urls = Array.isArray(job.hy3_product_urls) ? job.hy3_product_urls : [];
          console.log(`   Products: ${urls.length} file(s)`);
        }
      });
    }

    console.log('\n' + '━'.repeat(80));
    console.log('✅ Check complete\n');

  } catch (error) {
    console.error('❌ Error checking jobs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get infrastructure ID from command line args
const infraId = process.argv[2] || null;
checkJobsStatus(infraId).catch(console.error);

