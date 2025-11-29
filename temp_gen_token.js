const jwt = require('jsonwebtoken');
// Secret from gen_token_fix.js
const secret = 'TRD9urMBjxI9g4QUUhVysAuLOqI6X0ZD1r7XMHKsP5m5MP/1esplqAxpEpBx+MnPbu5Kn4JSqhxt4aPnBG07dg==';
const issuer = 'https://gwxdnekddmbeskaegdtu.supabase.co/auth/v1';

const token = jwt.sign({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
    sub: '494228d9-a762-4e36-ac83-16f872ee54eb',
    email: 'charlie.coupe59@gmail.com',
    role: 'authenticated',
    iss: issuer
}, secret);

console.log(token);
