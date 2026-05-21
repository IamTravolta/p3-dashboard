/**
 * GET /api/prices?tickers=AAPL:NASDAQ,SHEL:LSE,ASML:AMS
 *
 * Returns live prices for the requested tickers.
 * Strategy:
 *   1. Try Stooq batch (fast, free, no limit) — works great on local dev (home IP)
 *   2. Fall back to FMP per-ticker (works everywhere, uses API key)
 *
 * Tickers that Stooq returns N/D for are retried via FMP.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireUser }       from '@/lib/auth'
import { fetchStooqPrices }  from '@/lib/utils/stooq'

const FMP_KEY = process.env.FMP_API_KEY ?? ''

// ── FMP fallback — single ticker ─────────────────────────────────────────────
interface FmpQuote {
  price:         number
  previousClose: number
  changePercentage: number
}

async function fetchFmpPrice(
  ticker: string
): Promise<FmpQuote | null> {
  if (!FMP_KEY) return null
  try {
    const url  = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(ticker)}&apikey=${FMP_KEY}`
    const resp = await fetch(url, { next: { revalidate: 0 } })
    if (!resp.ok) return null
    const data = await resp.json() as FmpQuote[]
    const q    = Array.isArray(data) ? data[0] : null
    if (!q || !q.price) return null
    return q
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response

  const { searchParams } = new URL(request.url)
  const tickerParam      = searchParams.get('tickers')

  if (!tickerParam) {
    return NextResponse.json({ error: 'tickers param required' }, { status: 400 })
  }

  // Parse "AAPL:NASDAQ,SHEL:LSE" → [{ ticker, exchange }]
  const items = tickerParam.split(',').map((t) => {
    const [ticker, exchange = 'NYSE'] = t.trim().split(':')
    return { ticker: ticker.toUpperCase(), exchange: exchange.toUpperCase() }
  }).filter((i) => i.ticker.length > 0)

  if (items.length === 0) {
    return NextResponse.json({ prices: {}, prevPrices: {} })
  }

  const prices:     Record<string, number> = {}
  const prevPrices: Record<string, number> = {}
  const meta:       Record<string, { source: string; stale: boolean; date?: string }> = {}

  // ── Step 1: Stooq batch ───────────────────────────────────────────────────
  const stooqQuotes = await fetchStooqPrices(items)
  const staleTickers: Array<{ ticker: string; exchange: string }> = []

  for (const { ticker } of items) {
    const q = stooqQuotes[ticker]
    if (q && !q.stale && q.price > 0) {
      prices[ticker]    = q.price
      if (q.prevClose > 0) prevPrices[ticker] = q.prevClose
      meta[ticker] = { source: 'stooq', stale: false, date: q.date }
    } else {
      staleTickers.push(items.find((i) => i.ticker === ticker)!)
    }
  }

  // ── Step 2: FMP fallback for stale/missing tickers ────────────────────────
  if (staleTickers.length > 0 && FMP_KEY) {
    const fmpResults = await Promise.all(
      staleTickers.map(async ({ ticker }) => ({ ticker, q: await fetchFmpPrice(ticker) }))
    )
    for (const { ticker, q } of fmpResults) {
      if (q && q.price > 0) {
        prices[ticker]    = q.price
        if (q.previousClose > 0) prevPrices[ticker] = q.previousClose
        meta[ticker] = { source: 'fmp', stale: false }
      } else {
        meta[ticker] = { source: 'none', stale: true }
      }
    }
  }

  return NextResponse.json(
    { prices, prevPrices, meta },
    {
      headers: {
        // Short cache so repeated renders within a second don't re-fetch
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  )
}
