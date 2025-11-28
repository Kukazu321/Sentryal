import { Router } from 'express';
import healthRouter from './health';
import readyRouter from './ready';
import metricsRouter from './metrics';
import authRouter from './auth';
import infrastructuresRouter from './infrastructures';
import pointsRouter from './points';
import jobsRouter from './jobs';
import onboardingRouter from './onboarding';
import onboardingV2Router from './onboardingV2';
import dashboardRouter from './dashboard';
import deformationsRouter from './deformations';
import velocityRouter from './velocity';
import schedulesRouter from './schedules';
import debugRouter from './debug';
import apiKeysRouter from './apiKeys';

const router = Router();

router.use('/health', healthRouter);
router.use('/ready', readyRouter);
router.use('/metrics', metricsRouter);
router.use('/auth', authRouter);
router.use('/infrastructures', infrastructuresRouter);
router.use('/points', pointsRouter);
router.use('/jobs', jobsRouter);
router.use('/onboarding', onboardingRouter);
router.use('/v2/onboarding', onboardingV2Router);
router.use('/dashboard', dashboardRouter);
router.use('/deformations', deformationsRouter);
router.use('/velocity', velocityRouter);
router.use('/schedules', schedulesRouter);
router.use('/debug', debugRouter);
router.use('/keys', apiKeysRouter);

export default router;
