const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const migrationPath = path.join(__dirname, 'supabase', 'final_wallet_rpc_fix.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration...');
  
  // Split SQL into statements (naive split by ;)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 50)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
    if (error) {
      // If exec_sql doesn't exist, we might need another way or it might fail
      console.error('Error executing statement:', error);
      
      // Fallback: try direct query if possible (though service role usually can't run arbitrary SQL via REST)
      // On some setups, you have a helper RPC
    }
  }
}

runMigration();
// Joseph: Migration script
