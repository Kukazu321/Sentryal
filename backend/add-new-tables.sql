-- Add new tables for Worker Logs and Job Schedules
-- Run this SQL directly in your database

-- Create LogLevel enum
DO $$ BEGIN
    CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create worker_logs table
CREATE TABLE IF NOT EXISTS "worker_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT,
    "worker_name" VARCHAR(100) NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "error_stack" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for worker_logs
CREATE INDEX IF NOT EXISTS "worker_logs_job_id_idx" ON "worker_logs"("job_id");
CREATE INDEX IF NOT EXISTS "worker_logs_level_idx" ON "worker_logs"("level");
CREATE INDEX IF NOT EXISTS "worker_logs_created_at_idx" ON "worker_logs"("created_at");
CREATE INDEX IF NOT EXISTS "worker_logs_worker_name_idx" ON "worker_logs"("worker_name");

-- Create job_schedules table
CREATE TABLE IF NOT EXISTS "job_schedules" (
    "id" TEXT NOT NULL,
    "infrastructure_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "frequency_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "successful_runs" INTEGER NOT NULL DEFAULT 0,
    "failed_runs" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_schedules_pkey" PRIMARY KEY ("id")
);

-- Create indexes for job_schedules
CREATE INDEX IF NOT EXISTS "job_schedules_infrastructure_id_idx" ON "job_schedules"("infrastructure_id");
CREATE INDEX IF NOT EXISTS "job_schedules_user_id_idx" ON "job_schedules"("user_id");
CREATE INDEX IF NOT EXISTS "job_schedules_is_active_idx" ON "job_schedules"("is_active");
CREATE INDEX IF NOT EXISTS "job_schedules_next_run_at_idx" ON "job_schedules"("next_run_at");

-- Add foreign key constraint
ALTER TABLE "job_schedules" 
ADD CONSTRAINT "job_schedules_infrastructure_id_fkey" 
FOREIGN KEY ("infrastructure_id") 
REFERENCES "infrastructures"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add updated_at column to infrastructures if not exists
DO $$ BEGIN
    ALTER TABLE "infrastructures" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Tables created successfully!';
    RAISE NOTICE '✅ worker_logs table ready';
    RAISE NOTICE '✅ job_schedules table ready';
    RAISE NOTICE '✅ Indexes created';
    RAISE NOTICE '✅ Foreign keys added';
END $$;
