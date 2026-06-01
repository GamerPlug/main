import { NextResponse } from 'next/server'

export async function POST() {
    return NextResponse.json({ error: 'Agent downgrade is no longer supported. Roles are managed by admin.' }, { status: 410 })
}
