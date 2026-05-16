/**
 * POST /api/outcomes
 *
 * Evaluates verdicts at 30 / 60 / 90 day marks by comparing the verdict
 * against actual price movement. Updates signal_reliability accuracy counters.
 *
 * Called by a cron job or manually — checks all outstanding verdicts.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchStooqPrices } from '@/lib/utils/stooq'

const WINDOWS = [
  { days: 30,  field: 'evaluated_30d', outcome_field: 'outcome_30d'  },
  { days: 60,  field: 'evaluated_60d', outcome_field: 'outcome_60d'  },
  { days: 90,  field: 'evaluated_90d', outcome_field: 'outcome_90d'  },
] as const

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = Date.now()
    let evaluated = 0

    for (const win of WINDOWS) {
      const cutoff = new Date(now - win.days * 86400 * 1000).toISOString()

      // Find verdicts old enough but not yet evaluated at this window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: verdicts } = await (supabase as any)
        .from('verdicts')
        .select('id, ticker, verdict, generated_at')
        .eq('user_id', user.id)
        .eq(win.field, false)
        .lte('generated_at', cutoff)
        .limit(20)

      if (!verdicts?.length) continue

      // Fetch current prices in one batch
      const items = verdicts.map((v: { ticker: string }) => ({ ticker: v.ticker, exchange: 'NYSE' }))
      const prices = await fetchStooqPrices(items)

      for (const v of verdicts as { id: string; ticker: string; verdict: string; generated_at: string }[]) {
        const priceNow = prices[v.ticker]?.price
        if (!priceNow) continue

        // We need the entry price — look it up from verdict_outcomes or estimate from signals
        // For now, use a simple heuristic: correct if BUY and price moved up (>2%), or SELL and moved down
        // In production you'd store entry price in the verdict table.

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: outcome } = await (supabase as any)
          .from('verdict_outcomes')
          .select('entry_price')
          .eq('verdict_id', v.id)
          .single()

        if (!outcome?.entry_price) continue

        const returnPct = (priceNow - outcome.entry_price) / outcome.entry_price

        let correct = false
        if (v.verdict === 'BUY'  && returnPct >  0.02) correct = true
        if (v.verdict === 'SELL' && returnPct < -0.02) correct = true
        if (v.verdict === 'HOLD' && Math.abs(returnPct) < 0.05) correct = true

        // Update verdict
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('verdicts')
          .update({
            [win.field]:        true,
            [win.outcome_field]: correct ? 'CORRECT' : 'INCORRECT',
          })
          .eq('id', v.id)

        // Update signal_reliability
        for (const mod of ['technical', 'polymarket', 'sentiment'] as const) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rel } = await (supabase as any)
            .from('signal_reliability')
            .select('id, correct_signals')
            .eq('user_id', user.id)
            .eq('module_name', mod)
            .single()

          if (rel && correct) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('signal_reliability')
              .update({ correct_signals: (rel.correct_signals ?? 0) + 1 })
              .eq('id', rel.id)
          }
        }

        evaluated++
      }
    }

    return NextResponse.json({ evaluated })
  } catch (err) {
    console.error('Outcomes error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
