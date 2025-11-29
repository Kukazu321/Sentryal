const https = require('https');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY0NDIwMzM2LCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJlbWFpbCI6ImNoYXJsaWUuY291cGU1OUBnbWFpbC5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6Imh0dHBzOi8vZ3d4ZG5la2RkbWJlc2thZWdkdHUuc3VwYWJhc2UuY28vYXV0aC92MSIsImlhdCI6MTc2NDQxNjczNn0.mZjAFP2cxjy4ssTv3TBrtUZ8k9yhCx3clJ64k5bubBg";
const data = JSON.stringify({
    infrastructureId: "fa68a304-cb43-4021-980d-605bff671d6d"
});

const options = {
    hostname: 'sentryal-production.up.railway.app',
    port: 443,
    path: '/api/jobs/process-insar',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': data.length
    }
};

console.log('Sending request to ' + options.hostname + options.path);

const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);
    console.log('headers:', res.headers);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
