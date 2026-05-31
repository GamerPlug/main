const { Client } = require('pg');
const fs = require('fs');

function getEnvVar(key) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith(`${key}=`)) {
        return line.substring(key.length + 1).trim();
      }
    }
  } catch (e) {}
  return null;
}

const dbUrl = getEnvVar('DATABASE_URL');
if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const migrationPath = 'supabase/new_roles_pricing_migration.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');

async function apply() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to DB...');
    await client.connect();
    console.log('Running migration from ' + migrationPath + '...');
    await client.query(sql);
    console.log('Migration SUCCESSFUL!');
  } catch (err) {
    console.error('Migration FAILED:', err);
  } finally {
    await client.end();
  }
}

apply();
