import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from 'utils/supabase/server'

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. Fails closed when CRON_SECRET is unset. */
const isAuthorized = (req: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(req.headers.get('Authorization') ?? '')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set
  // in the project's environment variables; the GitHub keep-alive workflows send the same header.
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Query Supabase so the project doesn't pause for inactivity
    const supabase = await createClient()
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) throw new Error(error.message)
    return Response.json({ ok: true })
  } catch (error) {
    // Log the details server-side only; never return database error text to the caller.
    console.error('keep-alive failed:', (error as Error).message ?? error)
    return Response.json({ error: 'keep_alive_failed' }, { status: 500 })
  }
}
