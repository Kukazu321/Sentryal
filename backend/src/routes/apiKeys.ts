import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { requireInfraRole } from '../middleware/authorizeInfra';
import { apiKeyService, type ApiScope } from '../services/apiKeyService';
import logger from '../utils/logger';

const router = Router();

// Only user auth for key management (no API key allowed)
router.use(authMiddleware);

const CreateKeySchema = z.object({
    infrastructureId: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    scopes: z.array(z.enum(['read:map', 'write:jobs', 'admin:infra'])).min(1),
});

router.post(
    '/',
    validateBody(CreateKeySchema),
    requireInfraRole('admin', 'body', 'infrastructureId'),
    async (req: Request, res: Response) => {
        try {
            const { infrastructureId, name, scopes } = req.body as { infrastructureId: string; name?: string; scopes: ApiScope[] };
            const userId = req.userId!;
            const created = await apiKeyService.createKey(infrastructureId, userId, name || null, scopes);
            res.status(201).json(created);
        } catch (error) {
            logger.error({ error }, 'Failed to create API key');
            res.status(500).json({ error: 'Failed to create API key' });
        }
    }
);

router.get(
    '/',
    validateQuery(z.object({ infrastructureId: z.string().uuid() })),
    requireInfraRole('admin', 'query', 'infrastructureId'),
    async (req: Request, res: Response) => {
        try {
            const { infrastructureId } = req.query as { infrastructureId: string };
            const keys = await apiKeyService.listKeys(infrastructureId);
            res.json({ keys, count: keys.length });
        } catch (error) {
            logger.error({ error }, 'Failed to list API keys');
            res.status(500).json({ error: 'Failed to list API keys' });
        }
    }
);

router.delete(
    '/:id',
    async (req: Request, res: Response) => {
        try {
            if (!req.userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { id } = req.params;
            // Verify the key belongs to an infrastructure the user can admin
            const prismaClient = (await import('../db/prisma')).prisma;
            const rows = await prismaClient.$queryRaw<Array<{ infrastructure_id: string }>>`
                SELECT infrastructure_id FROM api_keys WHERE id = ${id}::uuid
            `;
            if (!rows[0]) {
                res.status(404).json({ error: 'API key not found' });
                return;
            }
            const infrastructureId = rows[0].infrastructure_id;
            // Inline RBAC check using middleware helper
            const { databaseService } = await import('../services/databaseService');
            const infrastructures = await databaseService.getUserInfrastructures(req.userId);
            const hasAccess = infrastructures.some((i: any) => i.id === infrastructureId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }
            await apiKeyService.revokeKey(id);
            res.json({ id, revoked: true });
        } catch (error) {
            logger.error({ error }, 'Failed to revoke API key');
            res.status(500).json({ error: 'Failed to revoke API key' });
        }
    }
);

export default router;
