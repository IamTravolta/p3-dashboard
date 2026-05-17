/**
 * POST /api/analyze/bulk
 *
 * Runs the full intelligence pipeline on every position and watchlist item
 * for the authenticated user. This is the "demo run" — seeds the system
 * with real verdicts so the Opportunity Engine has data to work with.
 *
 * Runs items concurrently in small batches to avoid rate limits.
 * Returns a summary of what was processed.
 */

import { NextResponse }           from 'next/server'
import { requireUser } from '@/lib/auth'
import { getTechnicalSignal }     from '@/lib/signals/technical'
import { getPolymarketSignal }    from '@/lib/signals/polymarket'
import { getSentimentSignal }     from '@/lib/signals/sentiment'
import { getVerdict }             from '@/lib/signals/verdict'
import { getSpeculationScore }    from '@/lib/signals/speculation'
import { getFundamentalsBundle }  from '@/lib/utils/fmp'
import { getMacroSnapshot }       from '@/lib/utils/fred'
import { getInsiderTransactions } from '@/lib/utils/edgar'
import type { Database }          from '@/lib/types/database'

type PositionRow  = Database['public']['Tables']['positions']['Row']
type WatchlistRow = Database['public']['Tables']['watchlist']['Row']

interface AnalysisItem {
  ticker:   string
  exchange: string
  sector:   string
  name:     string
  type:     'position' | 'watchlist'
  id:       string
}

async function analyseItem(
  item:    AnalysisItem,
  macro:   Awaited<ReturnType<typeof getMacroSnapshot>>,
  userId:  string,
  db: typeof import('@/lib/auth').supabaseAdmin,
): Promise<{ ticker: string; success: boolean; verdict?: string; error?: string }> {
  try {
    const [tech, poly, sent, fundamentals, insider] = await Promise.all([
      getTechnicalSignal(item.ticker, item.exchange),
      getPolymarketSignal(item.sector),
      getSentimentSignal(item.ticker, item.sector, item.name, undefined),
      getFundamentalsBundle(item.ticker),
      getInsiderTransactions(item.ticker),
    ])

    const verdict = await getVerdict(
      item.ticker, item.name, item.sector,
      tech, poly, sent,
      fundamentals, macro, insider,
    )

    const spec = await getSpeculationScore(
      item.ticker, item.exchange, item.sector,
      tech.raw_data.rsi14, tech.raw_data.relVolume,
      tech.raw_data.atr14, tech.raw_data.price,
    )

    const now = new Date().toISOString()

    const modulesSnapshot = {
      technical:  { value: tech.value,  confidence: tech.confidence,  reasoning: tech.reasoning },
      polymarket: { value: poly.value,  confidence: poly.confidence,  reasoning: poly.reasoning },
      sentiment:  { value: sent.value,  confidence: sent.confidence,  reasoning: sent.reasoning },
      score:      verdict.score,
      reasoning:  verdict.reasoning,
    }

    // Insert signal rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('signals').insert([
      { user_id: userId, ticker: item.ticker, module_name: 'technical',  value: tech.value,  confidence: tech.confidence,  reasoning: tech.reasoning,  raw_data: tech.raw_data  as unknown as Record<string, unknown> },
      { user_id: userId, ticker: item.ticker, module_name: 'polymarket', value: poly.value,  confidence: poly.confidence,  reasoning: poly.reasoning,  raw_data: poly.raw_data  as unknown as Record<string, unknown> },
      { user_id: userId, ticker: item.ticker, module_name: 'sentiment',  value: sent.value,  confidence: sent.confidence,  reasoning: sent.reasoning,  raw_data: sent.raw_data  as unknown as Record<string, unknown> },
    ])

    // Insert verdict
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('verdicts').insert({
      user_id:          userId,
      ticker:           item.ticker,
      final_verdict:    verdict.verdict,
      confidence:       verdict.confidence,
      modules_snapshot: modulesSnapshot as unknown as Record<string, unknown>,
      initial_price:    tech.raw_data.price > 0 ? tech.raw_data.price : 0,
      logged_at:        now,
    })

    // Speculation score
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('speculation_scores').insert({
      user_id:           userId,
      ticker:            item.ticker,
      speculation_score: spec.score,
      beta:              spec.factors.beta_proxy,
      momentum_score:    spec.factors.momentum,
      valuation_score:   null,
      iv_rank:           null,
      logged_at:         now,
    })

    // Volume snapshot
    if (tech.raw_data.price > 0) {
      const direction: 'up' | 'down' | 'flat' =
        tech.raw_data.rsi14 > 52 ? 'up' :
        tech.raw_data.rsi14 < 48 ? 'down' : 'flat'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from('volume_snapshots').insert({
        user_id:         userId,
        ticker:          item.ticker,
        volume:          (tech.raw_data as Record<string, unknown>).volume as number ?? 0,
        relative_volume: tech.raw_data.relVolume,
        price:           tech.raw_data.price,
        direction,
      })
    }

    return { ticker: item.ticker, success: true, verdict: verdict.verdict }
  } catch (err) {
    console.error(`[bulk analyse] ${item.ticker}:`, err)
    return { ticker: item.ticker, success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Batch runner — max N items in parallel to avoid hammering APIs
async function runBatch<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  batchSize = 3,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn))
  }
}

export async function POST() {
  try {
    const _auth = await requireUser()
    if ('response' in _auth) return _auth.response
    const { userId, db } = _auth

    // Load positions + watchlist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: positions } = await (db as any)
      .from('positions')
      .select('id, ticker, exchange, sector, name')
      .eq('user_id', userId) as { data: Pick<PositionRow, 'id' | 'ticker' | 'exchange' | 'sector' | 'name'>[] | null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: watchlist } = await (db as any)
      .from('watchlist')
      .select('id, ticker, exchange, sector, name')
      .eq('user_id', userId) as { data: Pick<WatchlistRow, 'id' | 'ticker' | 'exchange' | 'sector' | 'name'>[] | null }

    const items: AnalysisItem[] = [
      ...(positions ?? []).map((p) => ({ ...p, type: 'position' as const })),
      ...(watchlist ?? []).map((w) => ({ ...w, type: 'watchlist' as const })),
    ]

    if (items.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No positions or watchlist items found.' })
    }

    // Fetch macro once — shared across all items
    const macro = await getMacroSnapshot()

    const results: Array<{ ticker: string; success: boolean; verdict?: string; error?: string }> = []

    await runBatch(items, async (item) => {
      const result = await analyseItem(item, macro, userId, db)
      results.push(result)
    }, 2)  // 2 at a time — FMP has rate limits on free tier

    const succeeded = results.filter((r) => r.success)
    const failed    = results.filter((r) => !r.success)

    return NextResponse.json({
      processed:  results.length,
      succeeded:  succeeded.length,
      failed:     failed.length,
      failures:   failed.map((f) => ({ ticker: f.ticker, error: f.error })),
      verdicts:   succeeded.map((r) => ({ ticker: r.ticker, verdict: r.verdict })),
      macro:      { regime: macro.regime, summary: macro.regimeSummary },
    })
  } catch (err) {
    console.error('[bulk analyse] fatal:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
