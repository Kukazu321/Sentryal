import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { velocityCalculationService } from '../services/velocityCalculationService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication to all debug routes
router.use(authMiddleware);

/**
 * GET /api/debug/infrastructure/:id/data
 * Debug endpoint to see raw data from database
 * Requires authentication
 */
router.get('/infrastructure/:id/data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get points
    const points = await prisma.point.findMany({
      where: { infrastructure_id: id },
      take: 5,
    });

    // Get deformations for first point
    const firstPointDeformations = points.length > 0
      ? await prisma.deformation.findMany({
        where: { point_id: points[0].id },
        orderBy: { date: 'desc' },
        take: 10,
      })
      : [];

    // Get total deformations count
    const totalDeformations = await prisma.deformation.count({
      where: {
        point: {
          infrastructure_id: id,
        },
      },
    });

    res.json({
      infrastructure_id: id,
      points_count: points.length,
      total_deformations: totalDeformations,
      sample_points: points.map(p => ({
        id: p.id,
        geom: p.geom,
        created_at: p.created_at,
      })),
      first_point_deformations: firstPointDeformations.map(d => ({
        id: d.id,
        point_id: d.point_id,
        date: d.date,
        displacement_mm: d.displacement_mm.toString(),
        velocity_mm_year: d.velocity_mm_year?.toString(),
        coherence: d.coherence?.toString(),
      })),
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Debug failed', details: error });
  }
});

/**
 * POST /api/debug/infrastructure/:id/recalculate-velocities
 * Force recalculation of velocities for an infrastructure
 */
router.post('/infrastructure/:id/recalculate-velocities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Recalculating velocities for infrastructure ${id}...`);

    const velocityUpdates = await velocityCalculationService.calculateInfrastructureVelocities(id);

    if (velocityUpdates.length > 0) {
      await velocityCalculationService.updateVelocitiesInDatabase(velocityUpdates);
      console.log(`✅ Updated ${velocityUpdates.length} points with velocities`);
    }

    res.json({
      success: true,
      infrastructure_id: id,
      points_updated: velocityUpdates.length,
      velocities: velocityUpdates.slice(0, 5).map(v => ({
        pointId: v.pointId,
        velocity_mm_year: v.velocity_mm_year,
        r_squared: v.metadata.r_squared,
        data_quality: v.metadata.data_quality,
      })),
    });
  } catch (error) {
    console.error('Velocity recalculation error:', error);
    res.status(500).json({ error: 'Recalculation failed', details: error });
  }
});

export default router;
