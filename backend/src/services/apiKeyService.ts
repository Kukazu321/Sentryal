import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

function base64url(buf: Buffer) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export type ApiScope = 'read:map' | 'write:jobs' | 'admin:infra';

export interface CreatedApiKey {
    id: string;
    key: string; // plaintext, shown once
    keyPrefix: string;
    scopes: ApiScope[];
    createdAt: string;
}

export const apiKeyService = {
    async createKey(infrastructureId: string, userId: string, name: string | null, scopes: ApiScope[]): Promise<CreatedApiKey> {
        const prefix = base64url(crypto.randomBytes(6)); // ~8 chars
        const secret = base64url(crypto.randomBytes(24));
        const salt = base64url(crypto.randomBytes(16));

        const hash = await new Promise<string>((resolve, reject) => {
            crypto.scrypt(secret, salt, 64, (err, derivedKey) => {
                if (err) return reject(err);
                resolve(base64url(derivedKey as Buffer));
            });
        });

        const key = `sk_live_${prefix}.${secret}`;
        const scopesArray = scopes.map(s => s);

        const row = await prisma.$queryRaw<Array<{ id: string; created_at: Date }>>`
            INSERT INTO api_keys (infrastructure_id, user_id, name, key_prefix, key_salt, key_hash, scopes)
            VALUES (${infrastructureId}::uuid, ${userId}::uuid, ${name}, ${prefix}, ${salt}, ${hash}, ${scopesArray}::"ApiScope"[])
            RETURNING id, created_at
        `;

        return {
            id: row[0].id,
            key,
            keyPrefix: prefix,
            scopes,
            createdAt: row[0].created_at.toISOString(),
        };
    },

    async verifyKey(plaintextKey: string, infrastructureId: string, meta?: { route?: string; method?: string; ip?: string }) {
        try {
            // Expect format: sk_live_<prefix>.<secret>
            const m = plaintextKey.match(/^sk_[a-z]+_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
            if (!m) return null;
            const [, prefix, secret] = m;

            const rows = await prisma.$queryRaw<Array<{
                id: string;
                infrastructure_id: string;
                key_salt: string;
                key_hash: string;
                scopes: string[];
                revoked_at: Date | null;
            }>>`
                SELECT id, infrastructure_id, key_salt, key_hash, scopes::text[] as scopes, revoked_at
                FROM api_keys
                WHERE infrastructure_id = ${infrastructureId}::uuid AND key_prefix = ${prefix}
                LIMIT 1
            `;

            if (!rows[0]) return null;
            const k = rows[0];

            const computed = await new Promise<string>((resolve, reject) => {
                crypto.scrypt(secret, k.key_salt, 64, (err, derivedKey) => {
                    if (err) return reject(err);
                    resolve(base64url(derivedKey as Buffer));
                });
            });

            if (computed !== k.key_hash) return null;

            // Log usage asynchronously
            (async () => {
                try {
                    await prisma.$executeRaw`
                        UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = now() WHERE id = ${k.id}::uuid
                    `;
                    await prisma.$executeRaw`
                        INSERT INTO api_key_usage (api_key_id, route, http_method, status, ip)
                        VALUES (${k.id}::uuid, ${meta?.route ?? null}, ${meta?.method ?? null}, NULL, ${meta?.ip ?? null})
                    `;
                } catch (e) {
                    logger.warn({ e }, 'Failed to log API key usage');
                }
            })();

            return {
                id: rows[0].id,
                infrastructureId: rows[0].infrastructure_id,
                scopes: rows[0].scopes as ApiScope[],
                revokedAt: rows[0].revoked_at ? rows[0].revoked_at.toISOString() : null,
            };
        } catch (error) {
            logger.error({ error }, 'verifyKey failed');
            return null;
        }
    },

    async revokeKey(id: string) {
        await prisma.$executeRaw`
            UPDATE api_keys SET revoked_at = now() WHERE id = ${id}::uuid
        `;
    },

    async listKeys(infrastructureId: string) {
        const rows = await prisma.$queryRaw<Array<{
            id: string;
            name: string | null;
            key_prefix: string;
            scopes: string[];
            usage_count: number;
            last_used_at: Date | null;
            revoked_at: Date | null;
            created_at: Date;
        }>>`
            SELECT id, name, key_prefix, scopes::text[] as scopes, usage_count, last_used_at, revoked_at, created_at
            FROM api_keys
            WHERE infrastructure_id = ${infrastructureId}::uuid
            ORDER BY created_at DESC
        `;
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            keyPrefix: r.key_prefix,
            scopes: r.scopes as ApiScope[],
            usageCount: r.usage_count,
            lastUsedAt: r.last_used_at ? r.last_used_at.toISOString() : null,
            revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
            createdAt: r.created_at.toISOString(),
        }));
    },
};
