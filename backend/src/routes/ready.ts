import { Router, Request, Response } from 'express';
import { insarQueue } from '../workers/insarWorker';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const counts = await insarQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        const workerIdle = (counts.active || 0) === 0;
        res.json({
            ok: true,
            workerIdle,
            queue: counts,
        });
    } catch (error) {
        res.status(503).json({ ok: false, error: (error as Error).message });
    }
});

export default router;
