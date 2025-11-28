import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './utils/errorHandler';
import healthRouter from './routes/health';
import readyRouter from './routes/ready';
import metricsRouter from './routes/metrics';
import webhookRouter from './routes/webhook';
import { basicAuth } from './middleware/basicAuth';
import { insarQueue } from './workers/insarWorker';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ensureRBACSchema } from './db/bootstrap';

const app = express();

app.use(helmet());

// Enable CORS for frontend
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Convert BigInt to Number for JSON serialization
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const converted = convertBigIntToNumber(body);
    return originalJson(converted);
  };
  next();
});

function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        converted[key] = convertBigIntToNumber(obj[key]);
      }
    }
    return converted;
  }
  return obj;
}

app.use(morgan('dev'));

// Ensure RBAC schema exists (idempotent)
ensureRBACSchema().catch(() => {
  // Non-fatal in development
});

// Expose health/ready/metrics at top-level (also available under /api/*)
app.use('/health', healthRouter);
app.use('/ready', readyRouter);
app.use('/metrics', metricsRouter);

// Webhook endpoints (no auth required - signature verified internally)
app.use('/api/webhook', webhookRouter);

// Bull Board (queue UI) at /admin/queue with Basic Auth
const bullAdapter = new ExpressAdapter();
bullAdapter.setBasePath('/admin/queue');
createBullBoard({
  queues: [new BullMQAdapter(insarQueue)],
  serverAdapter: bullAdapter,
});
app.use('/admin/queue', basicAuth, bullAdapter.getRouter());

app.use('/api', routes);

// Small root endpoint to avoid 404s when someone hits the backend root
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend root - see /api/health for health check' });
});

app.use(errorHandler);

export default app;
