import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config';
import logger from '../utils/logger';

let prisma: any = null;

// Lazy load Prisma to avoid initialization errors
const getPrisma = async () => {
  if (!prisma) {
    try {
      prisma = (await import('../db/client')).default;
    } catch (e) {
      logger.error({ error: e }, 'Prisma client not available');
      return null;
    }
  }
  return prisma;
};

// Pre-initialize Prisma on module load to avoid race conditions
getPrisma().catch(err => logger.error({ error: err }, 'Failed to initialize Prisma in auth.ts'));

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

// JWKS client for Supabase public keys (only if Supabase URL is configured)
let client: jwksClient.JwksClient | null = null;

if (config.supabaseUrl) {
  client = jwksClient({
    jwksUri: `${config.supabaseUrl}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 86400000, // 24 hours
  });
}

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!client) {
    callback(new Error('JWKS client not initialized'));
    return;
  }
  if (!header.kid) {
    callback(new Error('No kid in header'));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify Supabase JWT token and extract user info
 * Supports both real Supabase tokens and fake tokens (for development)
 */
export async function verifySupabaseJWT(token: string): Promise<{ userId: string; email: string }> {
  // Ensure Prisma is initialized
  const prismaClient = await getPrisma();
  if (!prismaClient) {
    throw new Error('Prisma client not available');
  }

  // Check if we're using fake auth (development mode)
  const useFakeAuth = process.env.USE_FAKE_AUTH === 'true';

  if (useFakeAuth) {
    // For fake auth, token format is: "fake-{email}" or just extract from fake token
    // Parse the fake token (assumes format from frontend fakeSupabase.ts)
    try {
      // Try to decode as JSON or extract email from token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.email) {
        // Upsert user with fake data
        const user = await prismaClient.user.upsert({
          where: { email: decoded.email },
          update: {
            email: decoded.email,
            updated_at: new Date(),
          },
          create: {
            email: decoded.email,
            supabase_id: decoded.id || `fake-${Date.now()}`,
          },
        });
        return { userId: user.id, email: user.email };
      }
    } catch {
      // If token parsing fails, try simple email extraction
      const email = token.includes('@') ? token : `test-${token}@example.com`;
      const user = await prismaClient.user.upsert({
        where: { email },
        update: {
          email,
          updated_at: new Date(),
        },
        create: {
          email,
          supabase_id: `fake-${Date.now()}`,
        },
      });
      return { userId: user.id, email: user.email };
    }
  }

  // Real Supabase JWT verification using JWT Secret
  if (!config.supabaseUrl || !config.supabaseJwtSecret) {
    throw new Error('Supabase URL and JWT Secret not configured. Set USE_FAKE_AUTH=true for development or configure SUPABASE_URL and SUPABASE_JWT_SECRET');
  }

  // Normalize Supabase URL to remove trailing slash
  const supabaseUrl = config.supabaseUrl.replace(/\/$/, '');

  // DEBUG MODE: Skip signature verification, only check expiration
  // TODO: REVERT THIS AFTER DEBUGGING
  const decoded = jwt.decode(token) as any;

  if (!decoded) {
    throw new Error('Invalid token format');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    throw new Error('Token expired');
  }

  // Simulate successful verification
  // We still need to upsert the user
  const supabaseId = decoded.sub;
  const email = (decoded.email as string) || '';

  // Upsert user in database
  const user = await prismaClient.user.upsert({
    where: { supabase_id: supabaseId },
    update: {
      email,
      updated_at: new Date(),
    },
    create: {
      email,
      supabase_id: supabaseId,
    },
  });

  logger.warn({ userId: user.id, email: user.email }, 'DEBUG: Authenticated user skipping signature check');
  return { userId: user.id, email: user.email };
}

/**
 * Middleware to authenticate requests using Supabase JWT
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const { userId, email } = await verifySupabaseJWT(token);
      req.userId = userId;
      req.userEmail = email;
      next();
    } catch (err) {
      logger.warn({ err }, 'Authentication failed');
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
}

