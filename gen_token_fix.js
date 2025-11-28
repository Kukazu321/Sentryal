const jwt = require('jsonwebtoken');
const secret = 'TRD9urMBjxI9g4QUUhVysAuLOqI6X0ZD1r7XMHKsP5m5MP/1esplqAxpEpBx+MnPbu5Kn4JSqhxt4aPnBG07dg==';
console.log(jwt.sign({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 31536000,
    sub: '494228d9-a762-4e36-ac83-16f872ee54eb',
    email: 'charlie.coupe59@gmail.com',
    role: 'authenticated'
}, secret));
