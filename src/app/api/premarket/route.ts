import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response

  const tickers = req.nextUrl.searchParams.get('tickers') ?? ''
  if (!tickers) return NextResponse.json({ data: [] })

  const FMP_KEY = process.env.FMP_API_KEY ?? ''
  if (!FMP_KEY) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 })

  try {
    // FMP pre/post market endpoint
    const url = `https://financialmodelingprep.com/api/v4/pre-post-market-change?apikey=${FMP_KEY}`
    const resp = await fetch(url, { next: { revalidate: 300 } })
    const all = await resp.json() as Array<{ symbol: string; changesPercentage: number; change: number; price: number }>

    const tickerSet = new Set(tickers.split(',').map((t) => t.trim().toUpperCase()))
    const filtered = (Array.isArray(all) ? all : []).filter((r) => tickerSet.has(r.symbol))

    return NextResponse.json({ data: filtered })
  } catch (err) {
    console.error('[premarket]', err)
    return NextResponse.json({ error: 'Failed to fetch pre/after market data' }, { status: 500 })
  }
}
