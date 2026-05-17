/**
 * POST /api/outcomes
 *
 * Evaluates verdicts at 30 / 60 / 90 day marks by comparing the initial_price
 * stored in the verdict against the current live price.
 *
 * Each evaluation inserts a row into verdict_outcomes and updates
 * signal_reliability accuracy counters.
 *
 * Called by a cron job or manually from the Signals view.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchStooqPrices } from '@/lib/utils/stooq'

const WINDOWS = [30, 60, 90] as const

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = Date.now()
    let evaluated = 0

    for (const days of WINDOWS) {
      const cutoff = new Date(now - days * 86400 * 1000).toISOString()

      // Find verdicts that are old enough for this window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: verdicts } = await (supabase as any)
        .from('verdicts')
        .select('id, ticker, final_verdict, initial_price, logged_at')
        .eq('user_id', user.id)
        .lte('logged_at', cutoff)
        .gt('initial_price', 0)
        .limit(20)

      if (!verdicts?.length) continue

      // Skip verdicts already evaluated at this window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verdictIds = (verdicts as { id: string }[]).map((v) => v.id)
      const { data: existing } = await (supabase as any)
        .from('verdict_outcomes')
        .select('verdict_id')
        .in('verdict_id', verdictIds)
        .eq('days_since', days)

      const alreadyEvaluated = new Set(
        (existing ?? []).map((e: { verdict_id: string }) => e.verdict_id)
      )

      const pending = (verdicts as {
        id: string; ticker: string; final_verdict: string; initial_price: number; logged_at: string
      }[]).filter((v) => !alreadyEvaluated.has(v.id))

      if (pending.length === 0) continue

      // Fetch current prices in one batch (use NYSE as fallback exchange)
      const items = pending.map((v) => ({ ticker: v.ticker, exchange: 'NYSE' }))
      const prices = await fetchStooqPrices(items)

      for (const v of pending) {
        const quote = prices[v.ticker]
        if (!quote?.price || quote.price <= 0) continue

        const priceNow      = quote.price
        const returnPct     = ((priceNow - v.initial_price) / v.initial_price) * 100
        const returnDecimal = returnPct / 100

        let outcome: 'correct' | 'wrong' | 'neutral' | 'missed_gain'
        if (v.final_verdict === 'BUY') {
          outcome = returnDecimal >  0.02 ? 'correct'     :
                    returnDecimal < -0.02 ? 'wrong'        : 'neutral'
        } else if (v.final_verdict === 'SELL') {
          outcome = returnDecimal < -0.02 ? 'correct'     :
                    returnDecimal >  0.02 ? 'missed_gain'  : 'neutral'
        } else {
          // HOLD — correct if within ±5%
          outcome = Math.abs(returnDecimal) < 0.05 ? 'correct' : 'wrong'
        }

        const correct = outcome === 'correct'

        // Insert verdict_outcomes row
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('verdict_outcomes')
          .insert({
            verdict_id:       v.id,
            days_since:       days,
            price_then:       priceNow,
            price_change_pct: parseFloat(returnPct.toFixed(2)),
            outcome,
            evaluated_at:     new Date().toISOString(),
          })

        // Update signal_reliability for the correct window column
        const correctCol = `correct_${days}d` as 'correct_30d' | 'correct_60d' | 'correct_90d'

        for (const mod of ['technical', 'polymarket', 'sentiment'] as const) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rel } = await (supabase as any)
            .from('signal_reliability')
            .select(`id, ${correctCol}, wrong_30d, total`)
            .eq('user_id', user.id)
            .eq('module_signal_key', mod)
            .single()

          if (!rel) continue

          const updates: Record<string, number | string> = {
            last_updated: new Date().toISOString(),
          }

          if (correct) {
            updates[correctCol] = (rel[correctCol] ?? 0) + 1
          } else if (days === 30) {
            updates['wrong_30d'] = (rel.wrong_30d ?? 0) + 1
          }

          // Recompute accuracy_30d
          if (days === 30) {
            const c30 = (rel.correct_30d ?? 0) + (correct ? 1 : 0)
            const w30 = (rel.wrong_30d  ?? 0) + (correct ? 0 : 1)
            const total30 = c30 + w30
            if (total30 > 0) updates['accuracy_30d'] = parseFloat(((c30 / total30) * 100).toFixed(1))
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('signal_reliability')
            .update(updates)
            .eq('id', rel.id)
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
