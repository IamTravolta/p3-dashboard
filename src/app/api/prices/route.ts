/**
 * GET /api/prices?tickers=AAPL,MSFT:NASDAQ,SHEL:LSE
 *
 * Returns live prices from Stooq for the requested tickers.
 * Format: ticker:exchange (exchange defaults to NYSE if omitted)
 *
 * This proxies Stooq to avoid CORS in the browser and adds server-side
 * caching so we don't hammer Stooq on every client refresh.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchStooqPrices } from '@/lib/utils/stooq'

// Cache duration in seconds — Stooq updates every ~15 min during market hours
const CACHE_TTL = 60   // 1 minute

export async function GET(request: NextRequest) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tickerParam = searchParams.get('tickers')

  if (!tickerParam) {
    return NextResponse.json({ error: 'tickers param required' }, { status: 400 })
  }

  // Parse "AAPL,SHEL:LSE,ASML:AMS" → [{ ticker, exchange }]
  const items = tickerParam.split(',').map((t) => {
    const [ticker, exchange = 'NYSE'] = t.trim().split(':')
    return { ticker: ticker.toUpperCase(), exchange: exchange.toUpperCase() }
  }).filter((i) => i.ticker.length > 0)

  if (items.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const quotes = await fetchStooqPrices(items)

  // Build price maps: { AAPL: 213.45 } and prevPrices: { AAPL: 211.20 }
  const prices:     Record<string, number> = {}
  const prevPrices: Record<string, number> = {}
  const meta: Record<string, { volume: number; stale: boolean; date: string }> = {}

  for (const [ticker, q] of Object.entries(quotes)) {
    // Only include valid (non-stale, non-zero) prices so callers can safely
    // fall back to their stored currentPrice via `prices[ticker] ?? storedPrice`
    if (!q.stale && q.price > 0) {
      prices[ticker] = q.price
      if (q.prevClose > 0) prevPrices[ticker] = q.prevClose
    }
    meta[ticker] = { volume: q.volume, stale: q.stale, date: q.date }
  }

  return NextResponse.json(
    { prices, prevPrices, meta },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=30`,
      },
    }
  )
}
