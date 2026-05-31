const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'api_keys_migration.sql'), 'utf8');
    
    // Split statements by -- separator if it's there, but standard psql -f is better for complex SQL.
    // However, node-postgres can run multiple statements in one query.
    await client.query(sql);

    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Error applying migration:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
