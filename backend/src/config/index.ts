import dotenv from 'dotenv';
dotenv.config();

// Parse REDIS_URL if provided
function parseRedisUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return null;
  }
}

const redisFromUrl = parseRedisUrl(process.env.REDIS_URL);

interface Config {
  nodeEnv: string;
  port: string;
  databaseUrl: string;
  supabase: {
    url: string;
    jwtSecret: string;
    anonKey: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  frontendUrl: string;
  earthdata: {
    bearerToken: string;
  };
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '5000',
  databaseUrl: process.env.DATABASE_URL || '',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  redis: {
    host: redisFromUrl?.host || process.env.REDIS_HOST || 'localhost',
    port: redisFromUrl?.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: redisFromUrl?.password || process.env.REDIS_PASSWORD || undefined,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  earthdata: {
    bearerToken: process.env.EARTHDATA_BEARER_TOKEN || '',
  },
};
