import { Router, Request, Response } from 'express';
import { register, updateQueueGauges } from '../metrics/metrics';
import { insarQueue } from '../workers/insarWorker';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    await updateQueueGauges(insarQueue);
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

export default router;
