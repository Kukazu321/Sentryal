require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
    try {
        console.log("Columns in jobs table:");
        const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs'");
        console.log(cols.rows.map(r => r.column_name).join(', '));

        console.log("\nFirst 5 jobs:");
        const jobs = await client.query('SELECT * FROM jobs LIMIT 5');
        console.log(jobs.rows);
    } catch (e) { console.error(e); }
    await client.end();
});
