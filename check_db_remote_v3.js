require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
    try {
        console.log("Tables:");
        const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(r => r.table_name).join(', '));

        console.log("\nJobs Check:");
        try {
            const jobs = await client.query('SELECT id, status, "createdAt" FROM jobs ORDER BY "createdAt" DESC LIMIT 5');
            console.log("Row count:", jobs.rowCount);
            console.log("Rows:", jobs.rows);
        } catch (e) {
            console.log("Failed to query jobs: " + e.message);
        }
    } catch (e) { console.error(e); }
    await client.end();
});
