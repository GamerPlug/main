
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRLS() {
    const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error fetching admin_settings:', error.message)
    } else {
        console.log('Successfully fetched admin_settings:', data)
    }
}

checkRLS()
