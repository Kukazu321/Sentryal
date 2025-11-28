import { Request, Response, NextFunction } from 'express';

export function basicAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
        res.status(401).send('Authentication required');
        return;
    }

    const creds = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const [user, pass] = creds.split(':');

    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || '';

    if (user === adminUser && pass === adminPass && adminPass) {
        next();
        return;
    }

    res.status(403).send('Forbidden');
}
