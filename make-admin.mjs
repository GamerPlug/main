import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    let { data, error } = await supabase.from('users').select('*').limit(5);
    let tableName = 'users';

    if (error) {
        console.log('Error querying users table, trying profiles...');
        const res = await supabase.from('profiles').select('*').limit(5);
        data = res.data;
        error = res.error;
        tableName = 'profiles';
        if (error) {
            console.error('Error querying profiles table too:', error.message);
            process.exit(1);
        }
    }

    if (!data || data.length === 0) {
        console.log('No users found in the database. Please sign up in the browser first!');
        return;
    }

    console.log('Found users:', data.map(u => ({ email: u.email, role: u.role })));

    for (const user of data) {
        if (user.role === 'admin') {
            console.log(`User ${user.email} is already an admin.`);
            continue;
        }

        console.log(`Updating user ${user.email} in table ${tableName}...`);

        const { error: updateError } = await supabase
            .from(tableName)
            .update({ role: 'admin' })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to update user:', updateError.message);
        } else {
            console.log(`Successfully made ${user.email} an admin!`);
        }
    }
}

main();
