/**
 * GET /api/insider?ticker=AAPL
 *
 * Returns insider transaction data from SEC EDGAR Form 4 filings
 * for the past 90 days:
 * - List of open-market buys and sells by executives/directors
 * - Net buy signal: strong-buy | buy | neutral | sell | unknown
 * - Human-readable summary for verdict injection
 *
 * No API key required — uses the public EDGAR data API.
 */

import { NextRequest, NextResponse }   from 'next/server'
import { createClient }                from '@/lib/supabase/server'
import { getInsiderTransactions }      from '@/lib/utils/edgar'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = new URL(req.url).searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const data = await getInsiderTransactions(ticker)
  return NextResponse.json(data)
}
