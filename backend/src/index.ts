import app from './app';
import { config } from './config';
import { runMigrations } from './db/migrate';
import logger from './utils/logger';

// Import worker to start it (BullMQ worker auto-starts on import)
import './workers/insarWorker';

const PORT = Number(config.port || 5000);

async function startServer() {
  try {
    // Run migrations before starting server (non-blocking in dev)
    if (process.env.RUN_MIGRATIONS !== 'false') {
      try {
        await runMigrations();
      } catch (migrationError) {
        // In dev, don't block startup if migrations fail (DB might not be ready)
        if (process.env.NODE_ENV === 'production') {
          throw migrationError;
        }
        logger.warn({ error: migrationError }, 'Migrations failed - server will start anyway');
      }
    }

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Backend listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
