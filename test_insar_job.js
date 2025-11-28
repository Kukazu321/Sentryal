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
}, secret);

// ID infrastructure créée
const INFRASTRUCTURE_ID = '7937c8c2-0e90-4d58-a444-a4a0483645ce';

// Job InSAR de test
const data = JSON.stringify({
    infrastructureId: INFRASTRUCTURE_ID,
    type: 'insar_processing',
    parameters: {
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        mode: 'test_gpu'  // Pour tester les performances GPU
    }
});

console.log('Creating InSAR job for GPU test...');
console.log('Infrastructure ID:', INFRASTRUCTURE_ID);
console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/jobs',
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
        console.log('\nStatus:', res.statusCode);
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
