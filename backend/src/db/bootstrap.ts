import prisma from './client';
import logger from '../utils/logger';

/**
 * Ensure RBAC schema exists (idempotent).
 * Uses raw SQL to avoid Prisma migration dependency.
 */
export async function ensureRBACSchema() {
  try {
    // Ensure required extensions
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // Create enum type if not exists (idempotent block)
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InfraRole') THEN
          CREATE TYPE "InfraRole" AS ENUM ('OWNER','ADMIN','VIEWER');
        END IF;
      END
      $$;
    `);

    // Create table if not exists using InfraRole enum
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS infrastructure_members (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        infrastructure_id text NOT NULL REFERENCES infrastructures(id) ON DELETE CASCADE,
        role "InfraRole" NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, infrastructure_id)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_infra_members_user ON infrastructure_members(user_id);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_infra_members_infra ON infrastructure_members(infrastructure_id);
    `);

    logger.info('RBAC schema ensured (infrastructure_members ready)');

    // Seed owner memberships for existing infrastructures
    await prisma.$executeRawUnsafe(`
      INSERT INTO infrastructure_members (user_id, infrastructure_id, role)
      SELECT i.user_id, i.id, 'OWNER'::"InfraRole"
      FROM infrastructures i
      ON CONFLICT (user_id, infrastructure_id) DO NOTHING;
    `);

    // API Keys schema
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApiScope') THEN
          CREATE TYPE "ApiScope" AS ENUM ('read:map','write:jobs','admin:infra');
        END IF;
      END
      $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        infrastructure_id text NOT NULL REFERENCES infrastructures(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text,
        key_prefix text NOT NULL,
        key_salt text NOT NULL,
        key_hash text NOT NULL,
        scopes "ApiScope"[] NOT NULL,
        usage_count integer NOT NULL DEFAULT 0,
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_api_keys_infra_prefix ON api_keys(infrastructure_id, key_prefix);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        api_key_id text NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        used_at timestamptz NOT NULL DEFAULT now(),
        route text,
        http_method text,
        status integer,
        ip text
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id);
    `);
  } catch (error) {
    logger.error({ error }, 'Failed to ensure RBAC schema');
    throw error;
  }
}
