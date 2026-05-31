import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL.replace('@gmail.com', '%40gmail.com');

const client = new Client({ connectionString });

async function run() {
    await client.connect();
    const res = await client.query(`
    select schemaname, tablename, policyname, roles, cmd, qual, with_check 
    from pg_policies 
    where schemaname = 'public' and tablename in ('users', 'profiles', 'system_announcements', 'admin_settings');
  `);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
run();
