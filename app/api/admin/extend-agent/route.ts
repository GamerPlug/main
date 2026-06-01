import { NextResponse } from 'next/server'

export async function POST() {
    return NextResponse.json({ error: 'Agent expiry is no longer supported. Roles are permanent.' }, { status: 410 })
}
