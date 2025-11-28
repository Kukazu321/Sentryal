import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV,
  runMigrations: process.env.RUN_MIGRATIONS,
  frontendUrl: process.env.FRONTEND_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  earthdata: {
    bearerToken: process.env.EARTHDATA_BEARER_TOKEN || '',
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT, // e.g., https://<accountid>.r2.cloudflarestorage.com
    region: process.env.STORAGE_REGION || 'auto',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    bucketName: process.env.STORAGE_BUCKET_NAME || 'sentryal-results',
    publicUrl: process.env.STORAGE_PUBLIC_URL, // Optional: for public buckets
  },
};
