import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // if cron request does not contain correct secret, unauthorize the request
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
      },
    )
  }
  await fetch(`https://${process.env.NEXT_PUBLIC_VERCEL_URL}/`) // pre-warm the admin endpoint (/) to reduce cold starts
  return NextResponse.json({ ok: true })
}
