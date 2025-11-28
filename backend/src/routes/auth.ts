import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { verifySupabaseJWT } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/auth/me
 * Get current user information
 * Requires authentication via Bearer token
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const { userId, email } = await verifySupabaseJWT(token);

      res.json({
        userId,
        email,
      });
    } catch (err) {
      logger.warn({ err }, 'Authentication failed');
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get user info');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

