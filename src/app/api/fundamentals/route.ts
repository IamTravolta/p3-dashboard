/**
 * GET /api/fundamentals?ticker=AAPL
 *
 * Returns a full fundamentals bundle for a ticker:
 * - Next earnings date + days remaining
 * - Last 4 quarters earnings surprise history
 * - Key valuation metrics (P/E, EV/EBITDA, revenue growth, net margin)
 * - Analyst consensus + price target
 * - Estimate revision direction
 *
 * Data sourced from Financial Modeling Prep (FMP).
 * Responses are cached in Next.js fetch cache — no DB writes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { getFundamentalsBundle }     from '@/lib/utils/fmp'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = new URL(req.url).searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const bundle = await getFundamentalsBundle(ticker)
  return NextResponse.json({ ticker: ticker.toUpperCase(), ...bundle })
}
