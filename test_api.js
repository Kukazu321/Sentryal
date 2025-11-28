const jwt = require('jsonwebtoken');
const http = require('http');

const secret = 'TRD9urMBjxI9g4QUUhVysAuLOqI6X0ZD1r7XMHKsP5m5MP/1esplqAxpEpBx+MnPbu5Kn4JSqhxt4aPnBG07dg==';
const token = jwt.sign({
    aud: 'authenticated',
    iss: 'https://xvxwpadwbjtigkxiupux.supabase.co/auth/v1',
    exp: Math.floor(Date.now() / 1000) + 31536000,
    sub: '494228d9-a762-4e36-ac83-16f872ee54eb',
    email: 'charlie.coupe59@gmail.com',
    role: 'authenticated'
}, secret); const data = JSON.stringify({
    name: 'TestGPU',
    bbox: {
        minLat: 44.5,
        maxLat: 44.55,
        minLon: 6.3,
        maxLon: 6.35
    }
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/infrastructures',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            console.log('Response:', JSON.stringify(JSON.parse(body), null, 2));
        } catch (e) {
            console.log('Response:', body);
        }
    });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
