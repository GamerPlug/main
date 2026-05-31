const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function apply() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const sql = fs.readFileSync('supabase/new_roles_pricing_migration.sql', 'utf8');
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to DB...');
        await client.connect();
        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration SUCCESSFUL!');
    } catch (err) {
        console.error('Migration FAILED:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

apply();
