/**
 * GET /api/opportunity
 *
 * Returns scored opportunity assessments for all watchlist items and positions.
 * Each item is evaluated against 6 conditions — the result tells the user
 * exactly whether NOW is the right time to act and why.
 *
 * Data sources used per item:
 * - Latest verdict from Supabase (most recent AI analysis)
 * - Live price from store (passed as ?prices= query param or falls back to DB)
 * - FMP fundamentals (earnings date, growth, valuation)
 * - FRED macro snapshot (regime, VIX, yield curve)
 * - EDGAR insider transactions (90-day window)
 */

import { NextRequest, NextResponse }           from 'next/server'
import { createClient }                        from '@/lib/supabase/server'
import { getFundamentalsBundle }               from '@/lib/utils/fmp'
import { getMacroSnapshot }                    from '@/lib/utils/fred'
import { getInsiderTransactions }              from '@/lib/utils/edgar'
import { scoreWatchlistOpportunity, scorePositionHealth } from '@/lib/signals/opportunity'
import type { Database }                       from '@/lib/types/database'
import type { WatchlistItem, Position, FactorScores } from '@/lib/types/database'

type WatchlistRow = Database['public']['Tables']['watchlist']['Row']
type PositionRow  = Database['public']['Tables']['positions']['Row']

function rowToWatchlistItem(r: WatchlistRow): WatchlistItem {
  const fs = (r.factor_scores ?? {}) as { q?: number; g?: number; v?: number; m?: number; s?: number }
  return {
    id: r.id, ticker: r.ticker, name: r.name, exchange: r.exchange,
    sector: r.sector, subIndustry: r.sub_industry ?? '',
    currentPrice: r.current_price, score: r.score,
    factorScores: { q: fs.q ?? 0, g: fs.g ?? 0, v: fs.v ?? 0, m: fs.m ?? 0, s: fs.s ?? 0 },
    reason: r.reason ?? '', priceTrigger: r.price_trigger ?? null,
    scoreTrigger: r.score_trigger ?? null, conviction: r.conviction,
    expiryDate: r.expiry_date ?? null, addedDate: r.added_at,
  }
}

function rowToPosition(r: PositionRow): Position {
  const fs = (r.factor_scores ?? {}) as { q?: number; g?: number; v?: number; m?: number; s?: number }
  return {
    id: r.id, ticker: r.ticker, name: r.name, exchange: r.exchange,
    sector: r.sector, subIndustry: r.sub_industry ?? '',
    shares: r.shares, avgBuyPrice: r.avg_buy_price,
    currentPrice: r.current_price, currency: r.currency,
    factorScores: { q: fs.q ?? 0, g: fs.g ?? 0, v: fs.v ?? 0, m: fs.m ?? 0, s: fs.s ?? 0 } as FactorScores,
    conviction: r.conviction, thesis: r.thesis ?? '',
    notes: r.notes ?? '', addedDate: r.added_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Optional live prices passed from client as JSON (avoids stale DB prices)
    const pricesParam = new URL(req.url).searchParams.get('prices')
    const livePrices: Record<string, number> = pricesParam ? JSON.parse(pricesParam) : {}

    // ── Load positions + watchlist ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: wlRows }, { data: posRows }] = await Promise.all([
      (supabase as any).from('watchlist').select('*').eq('user_id', user.id),
      (supabase as any).from('positions').select('*').eq('user_id', user.id),
    ])

    const watchlist: WatchlistItem[] = (wlRows ?? []).map(rowToWatchlistItem)
    const positions: Position[]      = (posRows ?? []).map(rowToPosition)

    const allTickers = [...new Set([
      ...watchlist.map((w) => w.ticker),
      ...positions.map((p) => p.ticker),
    ])]

    if (allTickers.length === 0) {
      return NextResponse.json({ watchlist: [], positions: [], macro: null })
    }

    // ── Fetch macro once (4h cached) ──────────────────────────────────────────
    const macro = await getMacroSnapshot()

    // ── Fetch latest verdict per ticker ───────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: verdictRows } = await (supabase as any)
      .from('verdicts')
      .select('ticker, final_verdict, confidence, modules_snapshot, logged_at')
      .eq('user_id', user.id)
      .in('ticker', allTickers)
      .order('logged_at', { ascending: false })

    // Dedupe — keep only latest per ticker
    const latestVerdicts: Record<string, { final_verdict: string; confidence: number; reasoning?: string }> = {}
    for (const v of (verdictRows ?? [])) {
      if (!latestVerdicts[v.ticker]) {
        const reasoning = (v.modules_snapshot as { reasoning?: string } | null)?.reasoning
        latestVerdicts[v.ticker] = {
          final_verdict: v.final_verdict,
          confidence:    v.confidence,
          reasoning,
        }
      }
    }

    // ── Score items in parallel batches ───────────────────────────────────────
    async function scoreWatchlistItem(item: WatchlistItem) {
      const [fundamentals, insider] = await Promise.all([
        getFundamentalsBundle(item.ticker),
        getInsiderTransactions(item.ticker),
      ])
      const livePrice = livePrices[item.ticker] ?? item.currentPrice
      return scoreWatchlistOpportunity(
        item, livePrice, fundamentals, macro, insider,
        latestVerdicts[item.ticker] ?? null,
      )
    }

    async function scorePositionItem(pos: Position) {
      const fundamentals = await getFundamentalsBundle(pos.ticker)
      const livePrice    = livePrices[pos.ticker] ?? pos.currentPrice
      return scorePositionHealth(
        pos, livePrice, fundamentals, macro,
        latestVerdicts[pos.ticker] ?? null,
      )
    }

    // Run in batches of 3 to respect FMP rate limits
    const watchlistScores = []
    for (let i = 0; i < watchlist.length; i += 3) {
      const batch = await Promise.all(watchlist.slice(i, i + 3).map(scoreWatchlistItem))
      watchlistScores.push(...batch)
    }

    const positionScores = []
    for (let i = 0; i < positions.length; i += 3) {
      const batch = await Promise.all(positions.slice(i, i + 3).map(scorePositionItem))
      positionScores.push(...batch)
    }

    // Sort: highest score first
    watchlistScores.sort((a, b) => b.score - a.score)
    positionScores.sort((a, b) => a.score - b.score)  // worst health first for positions

    return NextResponse.json({
      watchlist: watchlistScores,
      positions: positionScores,
      macro: {
        regime:        macro.regime,
        regimeSummary: macro.regimeSummary,
        vix:           macro.vix,
        yieldSpread:   macro.yieldSpread,
        creditSpread:  macro.creditSpread,
      },
      scoredAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[opportunity] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
