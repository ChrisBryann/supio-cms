import { NextRequest, NextResponse } from 'next/server'
import { createClient } from 'utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  // if cron request does not contain correct secret, unauthorize the request
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
      },
    )
  }
  try {
    // Fetch user data from Supabase to prevent Supabase project from pausing
    const { data, error } = await supabase.from('users').select()
    if (error) throw new Error(error.message)
    return Response.json(data)
  } catch (error) {
    const message = (error as Error).message ?? 'An error occurred.'
    return Response.json({ error: message }, { status: 400 })
  }
}
