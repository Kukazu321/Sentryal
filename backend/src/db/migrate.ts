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
    
    const isProduction = process.env.NODE_ENV === 'production';
    const command = isProduction 
      ? 'npx prisma migrate deploy' 
      : 'npx prisma migrate deploy'; // Use deploy for both to avoid interactive prompts
    
    const backendPath = join(__dirname, '../..');
    
    execSync(command, {
      stdio: 'inherit',
      cwd: backendPath,
      env: { ...process.env },
    });
    
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error(error, 'Migration failed');
    // Don't throw in dev to allow server to start even if migrations fail
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
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

