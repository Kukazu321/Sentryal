const jwt = require('jsonwebtoken');
// Secret from Supabase project xvxwpadwbjtigkxiupux
const secret = 'TRD9urMBjxI9g4QUUhVysAuLOqI6X0ZD1r7XMHKsP5m5MP/1esplqAxpEpBx+MnPbu5Kn4JSqhxt4aPnBG07dg==';
const issuer = 'https://xvxwpadwbjtigkxiupux.supabase.co/auth/v1';

const token = jwt.sign({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
    sub: 'e7296862-dace-4e8b-b5bd-5726b86991ff',
    email: 'unchanged.gull.npxe@hidesmail.net',
    role: 'authenticated',
    iss: issuer
}, secret);

console.log(token);
