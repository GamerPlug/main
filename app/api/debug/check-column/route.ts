import { createServerClient } from '../../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = createServerClient()
        const { data, error } = await supabase
            .from('users')
            .select('requires_settlement')
            .limit(1)

        if (error) {
            return NextResponse.json({ exists: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ exists: true, data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
