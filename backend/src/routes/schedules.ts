import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { databaseService } from '../services/databaseService';
import { jobScheduleService } from '../services/jobScheduleService';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/schedules
 * Create a new job schedule
 */
router.post(
  '/',
  validateBody(z.object({
    infrastructureId: z.string().uuid(),
    name: z.string().min(1).max(255),
    frequencyDays: z.number().int().min(1).max(365),
    options: z.object({
      looks: z.string().optional(),
      includeDEM: z.boolean().optional(),
      includeIncMap: z.boolean().optional(),
      includeLosDisplacement: z.boolean().optional(),
    }).optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId, name, frequencyDays, options } = req.body;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      const schedule = await jobScheduleService.createSchedule({
        infrastructureId,
        userId: req.userId,
        name,
        frequencyDays,
        options,
      });

      res.status(201).json({
        message: 'Schedule created successfully',
        schedule,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create schedule');
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  }
);

/**
 * GET /api/schedules
 * Get all schedules for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schedules = await jobScheduleService.getUserSchedules(req.userId);

    res.json({
      schedules,
      count: schedules.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get schedules');
    res.status(500).json({ error: 'Failed to retrieve schedules' });
  }
});

/**
 * GET /api/schedules/infrastructure/:infrastructureId
 * Get schedules for a specific infrastructure
 */
router.get(
  '/infrastructure/:infrastructureId',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId } = req.params;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      const schedules = await jobScheduleService.getInfrastructureSchedules(infrastructureId);

      res.json({
        infrastructureId,
        schedules,
        count: schedules.length,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get infrastructure schedules');
      res.status(500).json({ error: 'Failed to retrieve schedules' });
    }
  }
);

/**
 * GET /api/schedules/:id
 * Get a specific schedule with statistics
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const stats = await jobScheduleService.getScheduleStats(id);

    res.json(stats);
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to get schedule');
    res.status(500).json({ error: 'Failed to retrieve schedule' });
  }
});

/**
 * PATCH /api/schedules/:id
 * Update a schedule
 */
router.patch(
  '/:id',
  validateBody(z.object({
    name: z.string().min(1).max(255).optional(),
    frequencyDays: z.number().int().min(1).max(365).optional(),
    isActive: z.boolean().optional(),
    options: z.any().optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const updated = await jobScheduleService.updateSchedule(id, updates);

      res.json({
        message: 'Schedule updated successfully',
        schedule: updated,
      });
    } catch (error) {
      logger.error({ error, scheduleId: req.params.id }, 'Failed to update schedule');
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  }
);

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await jobScheduleService.deleteSchedule(id);

    res.json({
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to delete schedule');
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * POST /api/schedules/:id/pause
 * Pause a schedule
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await jobScheduleService.updateSchedule(id, { isActive: false });

    res.json({
      message: 'Schedule paused successfully',
    });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to pause schedule');
    res.status(500).json({ error: 'Failed to pause schedule' });
  }
});

/**
 * POST /api/schedules/:id/resume
 * Resume a paused schedule
 */
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await jobScheduleService.updateSchedule(id, { isActive: true });

    res.json({
      message: 'Schedule resumed successfully',
    });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to resume schedule');
    res.status(500).json({ error: 'Failed to resume schedule' });
  }
});

/**
 * GET /api/schedules/stats/global
 * Get global schedule statistics (admin only in production)
 */
router.get('/stats/global', async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await jobScheduleService.getGlobalStats();

    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to get global stats');
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

export default router;
