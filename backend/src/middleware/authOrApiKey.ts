import { Request, Response, NextFunction } from 'express';
import { verifySupabaseJWT } from './auth';
import logger from '../utils/logger';

export function authOrApiKey() {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            const apiKeyHeader = (req.headers['x-api-key'] as string | undefined) || undefined;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const { userId, email } = await verifySupabaseJWT(token);
                    (req as any).userId = userId;
                    (req as any).userEmail = email;
                    return next();
                } catch (err) {
                    logger.warn({ err }, 'JWT auth failed in authOrApiKey');
                    // fallthrough to API key if provided
                }
            }

            if (apiKeyHeader) {
                (req as any).apiKeyHeader = apiKeyHeader;
                return next();
            }

            res.status(401).json({ error: 'Unauthorized' });
        } catch (error) {
            logger.error({ error }, 'authOrApiKey error');
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
