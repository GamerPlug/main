const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data: user } = await supabase.from('users').select('id').limit(1).single();
    const { data: pkg } = await supabase.from('data_packages').select('id').limit(1).single();

    const mockOrder = {
        user_id: user.id,
        package_id: pkg.id,
        phone_number: '0540000000',
        network: 'MTN',
        size: '1GB',
        bundle_name: '1GB',
        price: 10,
        amount: 10,
        cost_price: 8,
        status: 'pending',
        payment_status: 'paid',
        reference_code: 'TEST-' + Date.now(),
        reference: 'TEST-' + Date.now(),
        fulfillment_method: 'auto'
    };

    const { data, error } = await supabase.from('orders').insert(mockOrder).select();

    if (error) {
        console.log('--- DB INSERT ERROR ---');
        console.log(JSON.stringify(error, null, 2));
    } else {
        console.log('Insert successful:', data);
        // clean up
        await supabase.from('orders').delete().eq('id', data[0].id);
    }
}

run();
