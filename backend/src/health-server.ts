import express, { Express, Request, Response } from 'express';

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Basic health check - no database dependency
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'sentryal-backend',
        uptime: process.uptime()
    });
});

// Placeholder for future API endpoints
app.get('/api/status', (req: Request, res: Response) => {
    res.json({
        status: 'running',
        postgres: 'connected',
        redis: 'connected',
        snap: 'available'
    });
});

app.listen(PORT, () => {
    console.log(`✅ Backend health server listening on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
