import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import logger from '../utils/logger';
import { apiKeyService } from '../services/apiKeyService';

export type InfraAction = 'read' | 'write' | 'admin' | 'owner';

const ROLE_ORDER = {
  VIEWER: 1,
  ADMIN: 2,
  OWNER: 3,
} as const;

type RoleKey = keyof typeof ROLE_ORDER;

function minRoleForAction(action: InfraAction): RoleKey {
  switch (action) {
    case 'read':
      return 'VIEWER';
    case 'write':
      return 'ADMIN';
    case 'admin':
      return 'ADMIN';
    case 'owner':
      return 'OWNER';
  }
}

async function getUserInfraRole(userId: string, infrastructureId: string): Promise<RoleKey | null> {
  try {
    // Check membership via raw SQL with parameterized queries
    const rows = await prisma.$queryRaw<Array<{ role: string }>>`
      SELECT role::text as role
      FROM infrastructure_members
      WHERE user_id = ${userId}::uuid AND infrastructure_id = ${infrastructureId}::uuid
      LIMIT 1
    `;
    if (rows[0]?.role) {
      return rows[0].role as RoleKey;
    }

    // Fallback: owner via infrastructures.user_id
    const owned = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM infrastructures WHERE id = ${infrastructureId}::uuid AND user_id = ${userId}::uuid LIMIT 1
    `;
    if (owned[0]?.id) return 'OWNER';

    return null;
  } catch (error) {
    logger.error({ error, userId, infrastructureId }, 'getUserInfraRole failed');
    return null;
  }
}

export function requireInfraRole(
  action: InfraAction,
  source: 'params' | 'query' | 'body',
  field: string = source === 'params' ? 'id' : 'infrastructureId'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string | undefined;

      const container: any =
        source === 'params' ? req.params : source === 'query' ? req.query : req.body;
      const infrastructureId = container?.[field] as string | undefined;

      if (!infrastructureId) {
        // If no infraId present (e.g., creating new infra), skip and let next handler validate
        return next();
      }

      // API Key path: allow if scopes + infra match
      let apiKey = (req as any).apiKey as
        | { id: string; infrastructureId: string; scopes: string[]; revokedAt?: string | null }
        | undefined;
      if (!apiKey) {
        const apiKeyHeader = (req.headers['x-api-key'] as string | undefined) || undefined;
        if (apiKeyHeader) {
          apiKey = await apiKeyService.verifyKey(apiKeyHeader, infrastructureId, {
            route: req.originalUrl,
            method: req.method,
            ip: req.ip,
          }) as any;
          if (apiKey) (req as any).apiKey = apiKey;
        }
      }
      if (apiKey) {
        if (apiKey.revokedAt) {
          res.status(401).json({ error: 'API key revoked' });
          return;
        }
        if (apiKey.infrastructureId !== infrastructureId) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        const scopeForAction = (act: InfraAction) => {
          if (act === 'read') return 'read:map';
          if (act === 'write') return 'write:jobs';
          if (act === 'admin' || act === 'owner') return 'admin:infra';
          return 'read:map';
        };
        const needed = scopeForAction(action);
        if (apiKey.scopes.includes('admin:infra') || apiKey.scopes.includes(needed)) {
          return next();
        }
        res.status(403).json({ error: 'Insufficient API key scope' });
        return;
      }

      // User auth path
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userRole = await getUserInfraRole(userId, infrastructureId);
      if (!userRole) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      const required = minRoleForAction(action);
      if (ROLE_ORDER[userRole] < ROLE_ORDER[required]) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      return next();
    } catch (error) {
      logger.error({ error }, 'Authorization middleware failed');
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
}

export async function ensureOwnerMembership(userId: string, infrastructureId: string) {
  try {
    await prisma.$executeRaw`
      INSERT INTO infrastructure_members (user_id, infrastructure_id, role)
      VALUES (${userId}::uuid, ${infrastructureId}::uuid, 'OWNER')
      ON CONFLICT (user_id, infrastructure_id) DO NOTHING;
    `;
  } catch (error) {
    logger.error({ error, userId, infrastructureId }, 'Failed to ensure owner membership');
  }
}
