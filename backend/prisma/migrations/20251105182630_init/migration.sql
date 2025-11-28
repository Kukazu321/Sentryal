-- CreateEnum
CREATE TYPE "OnboardingMode" AS ENUM ('ADDRESS', 'DRAW', 'SHP');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "supabase_id" TEXT,
    "stripe_customer_id" TEXT,
    "preferences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infrastructures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "mode_onboarding" "OnboardingMode",
    "bbox" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points" (
    "id" TEXT NOT NULL,
    "infrastructure_id" TEXT NOT NULL,
    "geom" TEXT NOT NULL,
    "soil_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deformations" (
    "id" TEXT NOT NULL,
    "point_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "displacement_mm" DECIMAL(10,3) NOT NULL,
    "coherence" DECIMAL(5,3),
    "velocity_mm_year" DECIMAL(10,3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deformations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "infrastructure_id" TEXT NOT NULL,
    "hy3_job_id" TEXT,
    "hy3_job_type" VARCHAR(50),
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "bbox" TEXT,
    "hy3_product_urls" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE INDEX "infrastructures_user_id_idx" ON "infrastructures"("user_id");

-- CreateIndex
CREATE INDEX "points_infrastructure_id_idx" ON "points"("infrastructure_id");

-- CreateIndex
CREATE INDEX "deformations_point_id_idx" ON "deformations"("point_id");

-- CreateIndex
CREATE INDEX "deformations_job_id_idx" ON "deformations"("job_id");

-- CreateIndex
CREATE INDEX "deformations_date_idx" ON "deformations"("date");

-- CreateIndex
CREATE UNIQUE INDEX "deformations_point_id_job_id_date_key" ON "deformations"("point_id", "job_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_hy3_job_id_key" ON "jobs"("hy3_job_id");

-- CreateIndex
CREATE INDEX "jobs_infrastructure_id_idx" ON "jobs"("infrastructure_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_hy3_job_id_idx" ON "jobs"("hy3_job_id");

-- AddForeignKey
ALTER TABLE "infrastructures" ADD CONSTRAINT "infrastructures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points" ADD CONSTRAINT "points_infrastructure_id_fkey" FOREIGN KEY ("infrastructure_id") REFERENCES "infrastructures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deformations" ADD CONSTRAINT "deformations_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deformations" ADD CONSTRAINT "deformations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_infrastructure_id_fkey" FOREIGN KEY ("infrastructure_id") REFERENCES "infrastructures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Convert bbox column in infrastructures to GEOMETRY(POLYGON, 4326)
ALTER TABLE infrastructures ALTER COLUMN bbox TYPE GEOMETRY(POLYGON, 4326) USING ST_GeomFromText(bbox, 4326);

-- Convert geom column in points to GEOMETRY(POINT, 4326)
ALTER TABLE points ALTER COLUMN geom TYPE GEOMETRY(POINT, 4326) USING ST_GeomFromText(geom, 4326);

-- Convert bbox column in jobs to GEOMETRY(POLYGON, 4326)
ALTER TABLE jobs ALTER COLUMN bbox TYPE GEOMETRY(POLYGON, 4326) USING ST_GeomFromText(bbox, 4326);

-- Create spatial GIST indexes
CREATE INDEX infrastructures_bbox_idx ON infrastructures USING GIST (bbox);
CREATE INDEX points_geom_idx ON points USING GIST (geom);
CREATE INDEX jobs_bbox_idx ON jobs USING GIST (bbox);
