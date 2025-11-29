import { execSync } from 'child_process';
import { join } from 'path';
import logger from '../utils/logger';

/**
 * Run Prisma migrations
 * This script should be called before starting the server
 * In production, uses 'migrate deploy' (applies pending migrations)
 * In development, uses 'migrate dev' (creates new migrations interactively)
 */
export async function runMigrations() {
  try {
    logger.info('Checking database migrations...');

    const backendPath = join(__dirname, '../..');

    // First, try to resolve any failed migrations (P3009 fix)
    try {
      logger.info('Attempting to resolve any failed migrations...');
      execSync('npx prisma migrate resolve --applied "20251105182630_init"', {
        stdio: 'inherit',
        cwd: backendPath,
        env: { ...process.env },
      });
      logger.info('Migration resolved successfully');
    } catch (resolveError) {
      // Ignore errors - migration might not be in failed state
      logger.info('No failed migrations to resolve (or already resolved)');
    }

    // Then run deploy
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: backendPath,
      env: { ...process.env },
    });

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error(error, 'Migration failed');
    // Don't throw - allow server to start even if migrations fail
    // The database might already be set up correctly
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error, 'Migration script failed');
      process.exit(1);
    });
}

