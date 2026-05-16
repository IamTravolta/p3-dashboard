/**
 * GET /api/verdict?ticker=AAPL
 *
 * Returns the latest verdict + all historical verdicts for a ticker,
 * including outcome tracking (30/60/90 day performance vs prediction).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = new URL(request.url).searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Latest verdict with outcomes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: verdicts, error } = await (supabase as any)
    .from('verdicts')
    .select(`
      *,
      verdict_outcomes (*)
    `)
    .eq('user_id', user.id)
    .eq('ticker', ticker.toUpperCase())
    .order('logged_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ticker:  ticker.toUpperCase(),
    latest:  verdicts?.[0] ?? null,
    history: verdicts ?? [],
  })
}
