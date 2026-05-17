/**
 * POST /api/analyze
 *
 * Body: { ticker, exchange, sector, name, reason?, watchlist_id? }
 *
 * 1. Runs technical, polymarket, sentiment signal modules in parallel
 * 2. Fetches fundamentals (FMP), macro regime (FRED), insider data (EDGAR) in parallel
 * 3. Produces verdict via Claude — full context: signals + fundamentals + macro + insider
 * 4. Saves signals + verdict to Supabase
 * 5. Optionally saves speculation score + volume snapshot
 * 6. Returns { signals, verdict, speculation, fundamentals, macro, insider }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getTechnicalSignal }        from '@/lib/signals/technical'
import { getPolymarketSignal }       from '@/lib/signals/polymarket'
import { getSentimentSignal }        from '@/lib/signals/sentiment'
import { getVerdict }                from '@/lib/signals/verdict'
import { getSpeculationScore }       from '@/lib/signals/speculation'
import { getFundamentalsBundle }     from '@/lib/utils/fmp'
import { getMacroSnapshot }          from '@/lib/utils/fred'
import { getInsiderTransactions }    from '@/lib/utils/edgar'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      ticker:        string
      exchange:      string
      sector:        string
      name:          string
      reason?:       string
      watchlist_id?: string
      position_id?:  string
    }

    const { ticker, exchange, sector, name } = body
    if (!ticker || !exchange || !sector || !name) {
      return NextResponse.json({ error: 'Missing required fields: ticker, exchange, sector, name' }, { status: 400 })
    }

    const _auth = await requireUser()
    if ('response' in _auth) return _auth.response
    const { userId, db } = _auth

    // ── Run all signal modules + external data in parallel ────────────────────
    const [tech, poly, sent, fundamentals, macro, insider] = await Promise.all([
      getTechnicalSignal(ticker, exchange),
      getPolymarketSignal(sector),
      getSentimentSignal(ticker, sector, name, body.reason),
      getFundamentalsBundle(ticker),
      getMacroSnapshot(),
      getInsiderTransactions(ticker),
    ])

    // ── Verdict — now with full context ───────────────────────────────────────
    const verdict = await getVerdict(ticker, name, sector, tech, poly, sent, fundamentals, macro, insider)

    // ── Speculation score ─────────────────────────────────────────────────────
    const spec = await getSpeculationScore(
      ticker,
      exchange,
      sector,
      tech.raw_data.rsi14,
      tech.raw_data.relVolume,
      tech.raw_data.atr14,
      tech.raw_data.price,
    )

    // ── Persist signals to Supabase ───────────────────────────────────────────
    const now = new Date().toISOString()

    const signalRows = [
      {
        user_id:    userId,
        ticker,
        module_name: 'technical',
        value:       tech.value,
        confidence:  tech.confidence,
        reasoning:   tech.reasoning,
        raw_data:    tech.raw_data as unknown as Record<string, unknown>,
      },
      {
        user_id:    userId,
        ticker,
        module_name: 'polymarket',
        value:       poly.value,
        confidence:  poly.confidence,
        reasoning:   poly.reasoning,
        raw_data:    poly.raw_data as unknown as Record<string, unknown>,
      },
      {
        user_id:    userId,
        ticker,
        module_name: 'sentiment',
        value:       sent.value,
        confidence:  sent.confidence,
        reasoning:   sent.reasoning,
        raw_data:    sent.raw_data as unknown as Record<string, unknown>,
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedSignals, error: signalErr } = await (db as any)
      .from('signals')
      .insert(signalRows)
      .select()

    if (signalErr) console.error('Signal insert error:', signalErr)

    // ── Persist verdict ───────────────────────────────────────────────────────
    // modules_snapshot stores all three signal summaries for future reference
    const modulesSnapshot = {
      technical:  { value: tech.value,  confidence: tech.confidence,  reasoning: tech.reasoning  },
      polymarket: { value: poly.value,  confidence: poly.confidence,  reasoning: poly.reasoning  },
      sentiment:  { value: sent.value,  confidence: sent.confidence,  reasoning: sent.reasoning  },
      score:      verdict.score,
      reasoning:  verdict.reasoning,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedVerdict, error: verdictErr } = await (db as any)
      .from('verdicts')
      .insert({
        user_id:          userId,
        ticker,
        final_verdict:    verdict.verdict,
        confidence:       verdict.confidence,
        modules_snapshot: modulesSnapshot as unknown as Record<string, unknown>,
        initial_price:    tech.raw_data.price > 0 ? tech.raw_data.price : 0,
        logged_at:        now,
      })
      .select()
      .single()

    if (verdictErr) console.error('Verdict insert error:', verdictErr)

    // ── Persist speculation score ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from('speculation_scores')
      .insert({
        user_id:          userId,
        ticker,
        speculation_score: spec.score,
        beta:             spec.factors.beta_proxy,   // 0–10 proxy
        momentum_score:   spec.factors.momentum,
        valuation_score:  null,   // not computed in this module
        iv_rank:          null,   // not computed in this module
        logged_at:        now,
      })

    // ── Persist volume snapshot ───────────────────────────────────────────────
    if (tech.raw_data.price > 0) {
      const direction: 'up' | 'down' | 'flat' =
        tech.raw_data.rsi14 > 52 ? 'up' :
        tech.raw_data.rsi14 < 48 ? 'down' : 'flat'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .from('volume_snapshots')
        .insert({
          user_id:         userId,
          ticker,
          volume:          (tech.raw_data as Record<string, unknown>).volume as number ?? 0,
          relative_volume: tech.raw_data.relVolume,
          price:           tech.raw_data.price,
          direction,
        })
    }

    // ── Update signal_reliability counters ───────────────────────────────────
    for (const mod of ['technical', 'polymarket', 'sentiment'] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (db as any)
        .from('signal_reliability')
        .select('id, total')
        .eq('user_id', userId)
        .eq('module_signal_key', mod)
        .single()

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .from('signal_reliability')
          .update({ total: (existing.total ?? 0) + 1, last_updated: now })
          .eq('id', existing.id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .from('signal_reliability')
          .insert({
            user_id:           userId,
            module_signal_key: mod,
            total:             1,
            correct_30d:       0,
            correct_60d:       0,
            correct_90d:       0,
            wrong_30d:         0,
            last_updated:      now,
          })
      }
    }

    return NextResponse.json({
      signals:      savedSignals ?? signalRows,
      verdict:      savedVerdict ?? { final_verdict: verdict.verdict, confidence: verdict.confidence, ticker, logged_at: now },
      speculation:  spec,
      fundamentals,
      macro,
      insider,
    })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
