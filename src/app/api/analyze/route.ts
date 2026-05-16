/**
 * POST /api/analyze
 *
 * Body: { ticker, exchange, sector, name, reason?, watchlist_id? }
 *
 * 1. Runs technical, polymarket, sentiment signal modules in parallel
 * 2. Produces verdict via Claude (or rule-based fallback)
 * 3. Saves signals + verdict to Supabase
 * 4. Optionally saves speculation score + volume snapshot
 * 5. Returns { signals, verdict, speculation }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { getTechnicalSignal }        from '@/lib/signals/technical'
import { getPolymarketSignal }       from '@/lib/signals/polymarket'
import { getSentimentSignal }        from '@/lib/signals/sentiment'
import { getVerdict }                from '@/lib/signals/verdict'
import { getSpeculationScore }       from '@/lib/signals/speculation'

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

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Run all signal modules in parallel ────────────────────────────────────
    const [tech, poly, sent] = await Promise.all([
      getTechnicalSignal(ticker, exchange),
      getPolymarketSignal(sector),
      getSentimentSignal(ticker, sector, name, body.reason),
    ])

    // ── Verdict ───────────────────────────────────────────────────────────────
    const verdict = await getVerdict(ticker, name, sector, tech, poly, sent)

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
        user_id:      user.id,
        ticker,
        module_name:  'technical',
        value:        tech.value,
        confidence:   tech.confidence,
        reasoning:    tech.reasoning,
        raw_data:     tech.raw_data as unknown as Record<string, unknown>,
        generated_at: now,
        watchlist_id: body.watchlist_id ?? null,
        position_id:  body.position_id  ?? null,
      },
      {
        user_id:      user.id,
        ticker,
        module_name:  'polymarket',
        value:        poly.value,
        confidence:   poly.confidence,
        reasoning:    poly.reasoning,
        raw_data:     poly.raw_data as unknown as Record<string, unknown>,
        generated_at: now,
        watchlist_id: body.watchlist_id ?? null,
        position_id:  body.position_id  ?? null,
      },
      {
        user_id:      user.id,
        ticker,
        module_name:  'sentiment',
        value:        sent.value,
        confidence:   sent.confidence,
        reasoning:    sent.reasoning,
        raw_data:     sent.raw_data as unknown as Record<string, unknown>,
        generated_at: now,
        watchlist_id: body.watchlist_id ?? null,
        position_id:  body.position_id  ?? null,
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedSignals, error: signalErr } = await (supabase as any)
      .from('signals')
      .insert(signalRows)
      .select()

    if (signalErr) console.error('Signal insert error:', signalErr)

    // ── Persist verdict ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedVerdict, error: verdictErr } = await (supabase as any)
      .from('verdicts')
      .insert({
        user_id:      user.id,
        ticker,
        verdict:      verdict.verdict,
        confidence:   verdict.confidence,
        score:        verdict.score,
        reasoning:    verdict.reasoning,
        signals_used: verdict.signals_used,
        generated_at: now,
        watchlist_id: body.watchlist_id ?? null,
        position_id:  body.position_id  ?? null,
        evaluated_30d: false,
        evaluated_60d: false,
        evaluated_90d: false,
      })
      .select()
      .single()

    if (verdictErr) console.error('Verdict insert error:', verdictErr)

    // ── Persist speculation score ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('speculation_scores')
      .insert({
        user_id:    user.id,
        ticker,
        score:      spec.score,
        label:      spec.label,
        factors:    spec.factors as unknown as Record<string, unknown>,
        recorded_at: now,
      })

    // ── Persist volume snapshot ───────────────────────────────────────────────
    if (tech.raw_data.price > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('volume_snapshots')
        .insert({
          user_id:      user.id,
          ticker,
          rel_volume:   tech.raw_data.relVolume,
          recorded_at:  now,
        })
    }

    // ── Update signal_reliability counters ───────────────────────────────────
    for (const mod of ['technical', 'polymarket', 'sentiment'] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('signal_reliability')
        .select('id, total_signals')
        .eq('user_id', user.id)
        .eq('module_name', mod)
        .single()

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('signal_reliability')
          .update({ total_signals: (existing.total_signals ?? 0) + 1 })
          .eq('id', existing.id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('signal_reliability')
          .insert({ user_id: user.id, module_name: mod, total_signals: 1, correct_signals: 0 })
      }
    }

    return NextResponse.json({
      signals:     savedSignals ?? signalRows,
      verdict:     savedVerdict ?? { ...verdict, ticker, generated_at: now },
      speculation: spec,
    })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
