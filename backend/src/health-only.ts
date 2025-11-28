import express from 'express';

const app = express();
const PORT = 5000;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✓ Backend health server running on port ${PORT}`);
});
