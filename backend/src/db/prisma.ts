import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Prisma Client Singleton
 * 
 * Ensures only one instance of PrismaClient is created
 * Handles connection pooling and graceful shutdown
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
    }, 'Prisma query');
  });
}

prisma.$on('error', (e: any) => {
  logger.error({ error: e }, 'Prisma error');
});

prisma.$on('warn', (e: any) => {
  logger.warn({ warning: e }, 'Prisma warning');
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
});

export { Prisma };
export default prisma;
