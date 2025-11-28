/**
 * Re-export from prisma.ts for backwards compatibility
 * This file exists to maintain compatibility with imports from './db/client'
 * The actual Prisma client singleton is defined in ./prisma.ts
 */
import prisma, { Prisma } from './prisma';

export { prisma, Prisma };
export default prisma;
