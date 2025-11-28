import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import prisma from '../db/client';
import { Prisma } from '@prisma/client';

/**
 * DatabaseService provides PostGIS helpers and database operations
 * All queries use Prisma's tagged template literals to prevent SQL injection
 */
export class DatabaseService {
    constructor() {
        // All database operations now use Prisma
    }

    /**
     * Update infrastructure name/type
     */
    async updateInfrastructure(
        infrastructureId: string,
        data: { name?: string; type?: string | null }
    ) {
        // Build dynamic update using Prisma's safe raw queries
        if (data.name !== undefined && data.type !== undefined) {
            await prisma.$executeRaw`
        UPDATE infrastructures 
        SET name = ${data.name}, type = ${data.type}, updated_at = NOW() 
        WHERE id = ${infrastructureId}::uuid
      `;
        } else if (data.name !== undefined) {
            await prisma.$executeRaw`
        UPDATE infrastructures 
        SET name = ${data.name}, updated_at = NOW() 
        WHERE id = ${infrastructureId}::uuid
      `;
        } else if (data.type !== undefined) {
            await prisma.$executeRaw`
        UPDATE infrastructures 
        SET type = ${data.type}, updated_at = NOW() 
        WHERE id = ${infrastructureId}::uuid
      `;
        }

        const rows = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            name: string;
            type: string | null;
            bbox: string;
            mode_onboarding: string | null;
            created_at: Date;
            updated_at: Date;
        }>>`
      SELECT id, user_id, name, type, ST_AsText(bbox) as bbox, mode_onboarding, created_at, updated_at
      FROM infrastructures
      WHERE id = ${infrastructureId}::uuid
    `;

        const rec = rows[0];
        if (!rec) throw new Error('Infrastructure not found after update');
        return { ...rec, bbox: this.wktToGeoJSONPolygon(rec.bbox) };
    }

    /**
     * Delete infrastructure and related data
     */
    async deleteInfrastructure(infrastructureId: string) {
        logger.info({ infrastructureId }, '[INFRA-DELETE] Starting delete sequence');

        try {
            // Delete in safe order to satisfy foreign keys
            // 1) Deformations for points of infra
            await prisma.$executeRaw`
        DELETE FROM deformations
        WHERE point_id IN (SELECT id FROM points WHERE infrastructure_id = ${infrastructureId}::uuid)
      `;
            logger.info({}, '[INFRA-DELETE] Deleted deformations');

            // 2) Points
            await prisma.$executeRaw`
        DELETE FROM points WHERE infrastructure_id = ${infrastructureId}::uuid
      `;
            logger.info({}, '[INFRA-DELETE] Deleted points');

            // 3) Jobs
            await prisma.$executeRaw`
        DELETE FROM jobs WHERE infrastructure_id = ${infrastructureId}::uuid
      `;
            logger.info({}, '[INFRA-DELETE] Deleted jobs');

            // 4) Members
            await prisma.$executeRaw`
        DELETE FROM infrastructure_members WHERE infrastructure_id = ${infrastructureId}::uuid
      `;
            logger.info({}, '[INFRA-DELETE] Deleted members');

            // 5) Infrastructure
            await prisma.$executeRaw`
        DELETE FROM infrastructures WHERE id = ${infrastructureId}::uuid
      `;
            logger.info({ infrastructureId }, '[INFRA-DELETE] Infrastructure deleted');

            return { deleted: true };
        } catch (error) {
            logger.error({ error, infrastructureId }, '[INFRA-DELETE] Failed');
            throw error;
        }
    }

    /**
     * Convert GeoJSON Polygon to PostGIS WKT
     */
    private geoJSONPolygonToWKT(geoJSON: {
        type: 'Polygon';
        coordinates: number[][][];
    }): string {
        const rings = geoJSON.coordinates;
        const outerRing = rings[0];
        const coords = outerRing.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
        return `POLYGON((${coords}))`;
    }

    /**
     * Convert GeoJSON Point to PostGIS WKT
     */
    private geoJSONPointToWKT(geoJSON: {
        type: 'Point';
        coordinates: [number, number];
    }): string {
        const [lng, lat] = geoJSON.coordinates;
        return `POINT(${lng} ${lat})`;
    }

    /**
     * Convert WKT to GeoJSON Polygon
     */
    private wktToGeoJSONPolygon(wkt: string): {
        type: 'Polygon';
        coordinates: number[][][];
    } {
        const match = wkt.match(/POLYGON\(\((.*?)\)\)/);
        if (!match) {
            throw new Error('Invalid WKT Polygon');
        }
        const coords = match[1]
            .split(',')
            .map((c) => c.trim().split(' ').map(Number))
            .filter((c) => c.length === 2);
        return {
            type: 'Polygon',
            coordinates: [coords],
        };
    }

    /**
     * Convert WKT to GeoJSON Point
     */
    private wktToGeoJSONPoint(wkt: string): {
        type: 'Point';
        coordinates: [number, number];
    } {
        const match = wkt.match(/POINT\(([^)]+)\)/);
        if (!match) {
            throw new Error('Invalid WKT Point');
        }
        const [lng, lat] = match[1].split(' ').map(Number);
        return {
            type: 'Point',
            coordinates: [lng, lat],
        };
    }

    /**
     * Get all infrastructures for a user
     */
    async getUserInfrastructures(userId: string) {
        const infrastructures = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            name: string;
            type: string | null;
            bbox: string;
            mode_onboarding: string | null;
            created_at: Date;
            updated_at: Date;
        }>>`
      SELECT i.id, i.user_id, i.name, i.type, ST_AsText(i.bbox) as bbox, i.mode_onboarding, i.created_at, i.updated_at
      FROM infrastructures i
      WHERE i.user_id = ${userId}::uuid
         OR EXISTS (
           SELECT 1 FROM infrastructure_members m
           WHERE m.infrastructure_id = i.id AND m.user_id = ${userId}::uuid
         )
      ORDER BY i.created_at DESC
    `;

        return infrastructures.map((infra) => ({
            ...infra,
            bbox: this.wktToGeoJSONPolygon(infra.bbox),
        }));
    }

    /**
     * Create an infrastructure
     */
    async createInfrastructure(
        userId: string,
        data: {
            name: string;
            type?: string;
            bbox: { type: 'Polygon'; coordinates: number[][][] };
            mode_onboarding?: 'ADDRESS' | 'DRAW' | 'SHP';
        }
    ) {
        const bboxWKT = this.geoJSONPolygonToWKT(data.bbox);
        const id = randomUUID();
        const modeOnboarding = data.mode_onboarding || null;
        const type = data.type || null;

        logger.info({ id, userId, name: data.name }, '[INFRA-CREATE] Creating infrastructure');

        try {
            await prisma.$executeRaw`
        INSERT INTO infrastructures (id, user_id, name, type, bbox, mode_onboarding, created_at, updated_at)
        VALUES (
          ${id}::uuid,
          ${userId}::uuid,
          ${data.name},
          ${type},
          ST_GeomFromText(${bboxWKT}, 4326),
          ${modeOnboarding},
          NOW(),
          NOW()
        )
      `;
            logger.info({ id }, '[INFRA-CREATE] Infrastructure inserted successfully');
        } catch (error) {
            logger.error({ error, id }, '[INFRA-CREATE] INSERT failed');
            throw error;
        }

        // Fetch the created infrastructure
        const result = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            name: string;
            type: string | null;
            bbox: string;
            mode_onboarding: string | null;
            created_at: Date;
            updated_at: Date;
        }>>`
      SELECT id, user_id, name, type, ST_AsText(bbox) as bbox, mode_onboarding, created_at, updated_at
      FROM infrastructures
      WHERE id = ${id}::uuid
    `;

        if (!result[0]) {
            logger.error({ id }, '[INFRA-CREATE] Infrastructure not found after INSERT');
            throw new Error('Failed to create infrastructure');
        }

        const created = {
            ...result[0],
            bbox: this.wktToGeoJSONPolygon(result[0].bbox),
        };

        logger.info({ id, name: created.name }, '[INFRA-CREATE] Creating OWNER membership');

        // Ensure owner membership
        try {
            await prisma.$executeRaw`
        INSERT INTO infrastructure_members (user_id, infrastructure_id, role)
        VALUES (${userId}::uuid, ${created.id}::uuid, 'OWNER')
        ON CONFLICT (user_id, infrastructure_id) DO NOTHING
      `;
            logger.info({ userId, infraId: created.id }, '[INFRA-CREATE] OWNER membership created');
        } catch (e) {
            logger.error({ error: e, userId, infrastructureId: created.id }, '[INFRA-CREATE] Failed to ensure owner membership');
            throw e;
        }

        return created;
    }

    /**
     * Create points in batch
     */
    async createPoints(
        infrastructureId: string,
        points: Array<{ lat: number; lng: number }>
    ) {
        if (points.length === 0) {
            return [];
        }
        return this.createPointsBatch(infrastructureId, points);
    }

    /**
     * Create points in batch using raw SQL
     * Note: For batch inserts with dynamic data, we validate the inputs
     */
    private async createPointsBatch(
        infrastructureId: string,
        points: Array<{ lat: number; lng: number }>
    ) {
        // Validate infrastructureId is a valid UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(infrastructureId)) {
            throw new Error('Invalid infrastructure ID');
        }

        // Validate all points are valid numbers
        for (const point of points) {
            if (typeof point.lat !== 'number' || typeof point.lng !== 'number' ||
                isNaN(point.lat) || isNaN(point.lng) ||
                point.lat < -90 || point.lat > 90 ||
                point.lng < -180 || point.lng > 180) {
                throw new Error('Invalid point coordinates');
            }
        }

        // Build VALUES clause - coordinates are validated numbers
        const values = points
            .map((point) => `(gen_random_uuid(), '${infrastructureId}'::uuid, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326))`)
            .join(', ');

        const query = Prisma.sql`
      INSERT INTO points (id, infrastructure_id, geom)
      VALUES ${Prisma.raw(values)}
      RETURNING id, infrastructure_id, ST_AsText(geom) as geom, soil_type, created_at
    `;

        const result = await prisma.$queryRaw<Array<{
            id: string;
            infrastructure_id: string;
            geom: string;
            soil_type: string | null;
            created_at: Date;
        }>>(query);

        return result.map((row) => ({
            id: row.id,
            infrastructure_id: row.infrastructure_id,
            geom: this.wktToGeoJSONPoint(row.geom),
            soil_type: row.soil_type,
            created_at: row.created_at,
        }));
    }

    /**
     * Get points for an infrastructure
     */
    async getPointsByInfrastructure(infrastructureId: string) {
        const points = await prisma.$queryRaw<Array<{
            id: string;
            infrastructure_id: string;
            geom: string;
            soil_type: string | null;
            created_at: Date;
        }>>`
      SELECT id, infrastructure_id, ST_AsText(geom) as geom, soil_type, created_at
      FROM points
      WHERE infrastructure_id = ${infrastructureId}::uuid
      ORDER BY created_at DESC
    `;

        return points.map((p) => {
            try {
                return {
                    ...p,
                    geom: this.wktToGeoJSONPoint(p.geom),
                };
            } catch (error) {
                logger.error({ geom: p.geom, error }, 'Failed to convert WKT to GeoJSON');
                return {
                    ...p,
                    geom: p.geom as any,
                };
            }
        });
    }

    /**
     * Get points within a bounding box
     */
    async getPointsInBbox(bbox: { type: 'Polygon'; coordinates: number[][][] }) {
        const bboxWKT = this.geoJSONPolygonToWKT(bbox);

        const result = await prisma.$queryRaw<Array<{
            id: string;
            infrastructure_id: string;
            geom: string;
            soil_type: string | null;
            created_at: Date;
        }>>`
      SELECT id, infrastructure_id, ST_AsText(geom) as geom, soil_type, created_at
      FROM points
      WHERE ST_Within(geom, ST_GeomFromText(${bboxWKT}, 4326))
    `;

        return result.map((row) => ({
            id: row.id,
            infrastructure_id: row.infrastructure_id,
            geom: this.wktToGeoJSONPoint(row.geom),
            soil_type: row.soil_type,
            created_at: row.created_at,
        }));
    }

    /**
     * Calculate aggregated bounding box from points
     */
    async getAggregatedBbox(infrastructureId: string): Promise<{
        type: 'Polygon';
        coordinates: number[][][];
    }> {
        const result = await prisma.$queryRaw<Array<{ bbox: string }>>`
      SELECT ST_AsText(ST_Envelope(ST_Collect(geom))) as bbox
      FROM points
      WHERE infrastructure_id = ${infrastructureId}::uuid
    `;

        if (!result[0]?.bbox) {
            throw new Error('No points found for infrastructure');
        }

        return this.wktToGeoJSONPolygon(result[0].bbox);
    }

    /**
     * Get jobs for an infrastructure
     */
    async getJobsByInfrastructure(infrastructureId: string) {
        const jobs = await prisma.$queryRaw<Array<{
            id: string;
            infrastructure_id: string;
            hy3_job_id: string | null;
            hy3_job_type: string | null;
            status: string;
            bbox: string | null;
            hy3_product_urls: any;
            error_message: string | null;
            retry_count: number;
            processing_time_ms: number | null;
            created_at: Date;
            completed_at: Date | null;
        }>>`
      SELECT id, infrastructure_id, hy3_job_id, hy3_job_type, status,
             ST_AsText(bbox) as bbox, hy3_product_urls, error_message,
             retry_count, processing_time_ms, created_at, completed_at
      FROM jobs
      WHERE infrastructure_id = ${infrastructureId}::uuid
      ORDER BY created_at DESC
    `;

        return jobs.map((job) => ({
            ...job,
            bbox: job.bbox ? this.wktToGeoJSONPolygon(job.bbox) : null,
        }));
    }

    /**
     * Create a job
     */
    async createJob(
        infrastructureId: string,
        data: {
            hy3_job_id?: string;
            hy3_job_type?: string;
            status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
            bbox?: { type: 'Polygon'; coordinates: number[][][] };
        }
    ) {
        const id = randomUUID();
        const hy3JobId = data.hy3_job_id || null;
        const hy3JobType = data.hy3_job_type || null;

        logger.info({
            jobId: id,
            infrastructureId,
            hasBbox: !!data.bbox,
            status: data.status,
        }, 'Creating job in database');

        try {
            if (data.bbox) {
                const bboxWKT = this.geoJSONPolygonToWKT(data.bbox);
                await prisma.$executeRaw`
          INSERT INTO jobs (id, infrastructure_id, hy3_job_id, hy3_job_type, status, bbox, created_at)
          VALUES (
            ${id}::uuid,
            ${infrastructureId}::uuid,
            ${hy3JobId},
            ${hy3JobType},
            ${data.status},
            ST_GeomFromText(${bboxWKT}, 4326),
            NOW()
          )
        `;
            } else {
                await prisma.$executeRaw`
          INSERT INTO jobs (id, infrastructure_id, hy3_job_id, hy3_job_type, status, bbox, created_at)
          VALUES (
            ${id}::uuid,
            ${infrastructureId}::uuid,
            ${hy3JobId},
            ${hy3JobType},
            ${data.status},
            NULL,
            NOW()
          )
        `;
            }
            logger.info({ jobId: id }, 'Job INSERT completed');
        } catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : String(error),
                jobId: id,
                infrastructureId
            }, 'Failed to INSERT job');
            throw error;
        }

        // Fetch the created job
        const result = await prisma.$queryRaw<Array<{
            id: string;
            infrastructure_id: string;
            hy3_job_id: string | null;
            hy3_job_type: string | null;
            status: string;
            bbox: string | null;
            hy3_product_urls: any;
            error_message: string | null;
            retry_count: number;
            processing_time_ms: number | null;
            created_at: Date;
            completed_at: Date | null;
        }>>`
      SELECT id, infrastructure_id, hy3_job_id, hy3_job_type, status, 
             ST_AsText(bbox) as bbox, hy3_product_urls, error_message, 
             retry_count, processing_time_ms, created_at, completed_at
      FROM jobs
      WHERE id = ${id}::uuid
    `;

        if (!result[0]) {
            throw new Error('Failed to create job');
        }

        return {
            ...result[0],
            bbox: result[0].bbox ? this.wktToGeoJSONPolygon(result[0].bbox) : null,
        };
    }

    /**
     * Close database connections
     */
    async close() {
        await prisma.$disconnect();
    }
}

export const databaseService = new DatabaseService();
