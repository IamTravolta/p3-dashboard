/**
 * Opportunity Engine
 *
 * Evaluates each watchlist item and position against up to 6 conditions
 * to determine whether NOW is the right time to act.
 *
 * For watchlist items (BUY candidates):
 *   Condition 1 — Technical setup (BULLISH signal)
 *   Condition 2 — Macro regime supportive (risk-on / cautious)
 *   Condition 3 — Earnings safe window (> 14 days away)
 *   Condition 4 — Score at or above conviction trigger
 *   Condition 5 — Price at or below price trigger (if set)
 *   Condition 6 — Insider activity neutral or positive
 *
 * For positions (HOLD/SELL assessment):
 *   Condition 1 — Score still healthy (>= 5)
 *   Condition 2 — P&L not through stop loss
 *   Condition 3 — Macro regime not crisis
 *   Condition 4 — No earnings binary risk (< 7 days)
 *   Condition 5 — Technical not BEARISH
 *   Condition 6 — Estimate revisions not down
 *
 * 5–6 conditions met → strong signal
 * 4   conditions met → worth a close look
 * ≤ 3 conditions met → not yet / review needed
 */

import type { WatchlistItem, Position } from '@/lib/types/database'
import type { FundamentalsBundle }       from '@/lib/utils/fmp'
import type { MacroSnapshot }            from '@/lib/utils/fred'
import type { InsiderSummary }           from '@/lib/utils/edgar'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpportunityStrength = 'strong' | 'moderate' | 'weak' | 'avoid'
export type ActionType          = 'BUY' | 'HOLD' | 'REVIEW' | 'SELL'

export interface ConditionResult {
  label:   string
  met:     boolean
  partial: boolean   // half-credit
  detail:  string
}

export interface OpportunityScore {
  ticker:        string
  name:          string
  type:          'watchlist' | 'position'
  action:        ActionType
  strength:      OpportunityStrength
  score:         number   // 0–6
  maxScore:      number   // always 6
  conditions:    ConditionResult[]
  headline:      string   // e.g. "5/6 conditions aligned — strong BUY setup"
  reasoning:     string   // plain-English paragraph
  verdict?:      string   // from last AI analysis
  verdictConf?:  number
  price?:        number
  pnlPct?:       number   // positions only
  scoredAt:      string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function points(c: ConditionResult): number {
  return c.met ? 1 : c.partial ? 0.5 : 0
}

function strength(score: number): OpportunityStrength {
  if (score >= 5)   return 'strong'
  if (score >= 3.5) return 'moderate'
  if (score >= 2)   return 'weak'
  return 'avoid'
}

function buyAction(score: number): ActionType {
  if (score >= 4) return 'BUY'
  return 'HOLD'  // "not yet" for watchlist items
}

function holdAction(score: number): ActionType {
  if (score >= 5) return 'HOLD'
  if (score >= 3) return 'REVIEW'
  return 'SELL'
}

// ── Watchlist opportunity scoring ─────────────────────────────────────────────

export function scoreWatchlistOpportunity(
  item:         WatchlistItem,
  livePrice:    number,
  fundamentals: FundamentalsBundle | null,
  macro:        MacroSnapshot      | null,
  insider:      InsiderSummary     | null,
  lastVerdict?: { final_verdict: string; confidence: number; reasoning?: string } | null,
): OpportunityScore {
  const conditions: ConditionResult[] = []
  const now = new Date().toISOString()

  // ── 1. Technical / Verdict signal ────────────────────────────────────────────
  const verdictLabel = lastVerdict?.final_verdict ?? null
  const techMet     = verdictLabel === 'BUY'
  const techPartial = verdictLabel === 'HOLD'
  conditions.push({
    label:   'Signal verdict',
    met:     techMet,
    partial: techPartial,
    detail:  lastVerdict
      ? `Last verdict: ${verdictLabel} (${((lastVerdict.confidence ?? 0) * 100).toFixed(0)}% conf)`
      : 'No verdict yet — run analysis first',
  })

  // ── 2. Macro regime ───────────────────────────────────────────────────────────
  const regime = macro?.regime ?? null
  const macroMet     = regime === 'risk-on'
  const macroPartial = regime === 'cautious'
  conditions.push({
    label:   'Macro regime',
    met:     macroMet,
    partial: macroPartial,
    detail:  macro
      ? `${macro.regime} — VIX ${macro.vix?.toFixed(1) ?? '?'}, spread ${macro.yieldSpread != null ? (macro.yieldSpread >= 0 ? '+' : '') + macro.yieldSpread.toFixed(2) + '%' : '?'}`
      : 'Macro data unavailable',
  })

  // ── 3. Earnings safe window ───────────────────────────────────────────────────
  const dte = fundamentals?.daysToEarnings ?? null
  const earningsMet     = dte === null || dte > 14
  const earningsPartial = dte !== null && dte > 7 && dte <= 14
  conditions.push({
    label:   'Earnings timing',
    met:     earningsMet && dte !== null,
    partial: earningsPartial,
    detail:  dte !== null
      ? dte <= 7
        ? `⚠ Earnings in ${dte} days — binary risk, avoid entry`
        : dte <= 14
        ? `Earnings in ${dte} days — elevated risk, size carefully`
        : `Earnings in ${dte} days — safe window`
      : 'No earnings date found',
  })

  // ── 4. Score / conviction threshold ──────────────────────────────────────────
  const trigger   = item.scoreTrigger ?? 7
  const scoreMet  = item.score >= trigger
  const scorePart = item.score >= trigger * 0.85
  conditions.push({
    label:   'Score threshold',
    met:     scoreMet,
    partial: !scoreMet && scorePart,
    detail:  `Score ${item.score.toFixed(1)} vs trigger ${trigger} — ${scoreMet ? 'threshold reached' : `${(trigger - item.score).toFixed(1)} points below trigger`}`,
  })

  // ── 5. Price trigger ──────────────────────────────────────────────────────────
  const priceTrigger = item.priceTrigger
  if (priceTrigger != null && priceTrigger > 0) {
    const priceMet  = livePrice <= priceTrigger
    const pricePart = livePrice <= priceTrigger * 1.05
    conditions.push({
      label:   'Price trigger',
      met:     priceMet,
      partial: !priceMet && pricePart,
      detail:  `Live ${livePrice.toFixed(2)} vs trigger ${priceTrigger.toFixed(2)} — ${
        priceMet
          ? 'at or below target entry'
          : `${((livePrice / priceTrigger - 1) * 100).toFixed(1)}% above trigger`
      }`,
    })
  } else {
    // No price trigger set — give partial credit (can't evaluate)
    conditions.push({
      label:   'Price trigger',
      met:     false,
      partial: true,
      detail:  'No price trigger set — set one for better entry discipline',
    })
  }

  // ── 6. Insider activity ───────────────────────────────────────────────────────
  const insiderSignal = insider?.netBuySignal ?? 'unknown'
  const insiderMet     = insiderSignal === 'strong-buy' || insiderSignal === 'buy'
  const insiderPartial = insiderSignal === 'neutral' || insiderSignal === 'unknown'
  conditions.push({
    label:   'Insider activity',
    met:     insiderMet,
    partial: insiderPartial,
    detail:  insider?.summary ?? 'No insider data available',
  })

  // ── Totals ────────────────────────────────────────────────────────────────────
  const totalScore  = parseFloat(conditions.reduce((s, c) => s + points(c), 0).toFixed(1))
  const str         = strength(totalScore)
  const action      = buyAction(totalScore)

  // ── Reasoning ────────────────────────────────────────────────────────────────
  const metLabels  = conditions.filter((c) => c.met).map((c) => c.label)
  const missLabels = conditions.filter((c) => !c.met && !c.partial).map((c) => c.label)

  let reasoning = `${item.ticker} has ${totalScore.toFixed(1)} of 6 conditions aligned.`
  if (metLabels.length > 0)  reasoning += ` Green: ${metLabels.join(', ')}.`
  if (missLabels.length > 0) reasoning += ` Not yet: ${missLabels.join(', ')}.`
  if (fundamentals?.estimateRevisions === 'up')
    reasoning += ` Analyst estimates are rising — a bullish signal.`
  if (fundamentals?.estimateRevisions === 'down')
    reasoning += ` Analyst estimates are falling — watch carefully.`
  if (lastVerdict?.reasoning)
    reasoning += ` Latest AI reasoning: ${lastVerdict.reasoning.slice(0, 200)}…`

  const headline = action === 'BUY'
    ? `${totalScore.toFixed(1)}/6 conditions aligned — ${str === 'strong' ? 'strong BUY setup' : 'consider entry'}`
    : `${totalScore.toFixed(1)}/6 conditions met — not yet, monitor closely`

  return {
    ticker:       item.ticker,
    name:         item.name,
    type:         'watchlist',
    action,
    strength:     str,
    score:        totalScore,
    maxScore:     6,
    conditions,
    headline,
    reasoning,
    verdict:      lastVerdict?.final_verdict ?? undefined,
    verdictConf:  lastVerdict?.confidence    ?? undefined,
    price:        livePrice,
    scoredAt:     now,
  }
}

// ── Position health scoring ───────────────────────────────────────────────────

export function scorePositionHealth(
  position:     Position,
  livePrice:    number,
  fundamentals: FundamentalsBundle | null,
  macro:        MacroSnapshot      | null,
  lastVerdict?: { final_verdict: string; confidence: number; reasoning?: string } | null,
): OpportunityScore {
  const conditions: ConditionResult[] = []
  const now    = new Date().toISOString()
  const pnlPct = position.avgBuyPrice > 0
    ? ((livePrice - position.avgBuyPrice) / position.avgBuyPrice) * 100
    : 0

  // Compute factor score
  const fs = position.factorScores
  const factorScore = fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15

  // ── 1. Conviction score still healthy ─────────────────────────────────────────
  const scoreMet     = factorScore >= 6
  const scorePartial = factorScore >= 4.5
  conditions.push({
    label:   'Conviction score',
    met:     scoreMet,
    partial: !scoreMet && scorePartial,
    detail:  `Factor score ${factorScore.toFixed(1)}/10 — ${
      scoreMet ? 'healthy, thesis intact' :
      scorePartial ? 'weakening, review thesis' :
      'deteriorated, consider exiting'
    }`,
  })

  // ── 2. P&L within acceptable range (> -15%) ──────────────────────────────────
  const pnlMet     = pnlPct > -10
  const pnlPartial = pnlPct > -20 && pnlPct <= -10
  conditions.push({
    label:   'P&L health',
    met:     pnlMet,
    partial: pnlPartial,
    detail:  `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% from avg buy ${position.avgBuyPrice.toFixed(2)} — ${
      pnlMet ? 'within range' :
      pnlPartial ? 'approaching stop loss territory' :
      'stop loss likely breached'
    }`,
  })

  // ── 3. Macro regime not crisis / risk-off ────────────────────────────────────
  const regime       = macro?.regime ?? 'unknown'
  const macroMet     = regime === 'risk-on' || regime === 'cautious'
  const macroPartial = regime === 'unknown'
  conditions.push({
    label:   'Macro regime',
    met:     macroMet,
    partial: macroPartial,
    detail:  macro
      ? `${macro.regime} — ${macro.regimeSummary.slice(0, 80)}`
      : 'Macro data unavailable',
  })

  // ── 4. No imminent earnings binary risk ──────────────────────────────────────
  const dte            = fundamentals?.daysToEarnings ?? null
  const earningsMet    = dte === null || dte > 7
  const earningsPart   = dte !== null && dte > 3 && dte <= 7
  conditions.push({
    label:   'Earnings risk',
    met:     earningsMet,
    partial: earningsPart,
    detail:  dte !== null
      ? dte <= 3
        ? `⚠ Earnings in ${dte} days — high binary risk, review sizing`
        : dte <= 7
        ? `Earnings in ${dte} days — elevated risk window`
        : `Earnings in ${dte} days — no immediate risk`
      : 'No upcoming earnings found',
  })

  // ── 5. Verdict / technical not BEARISH ───────────────────────────────────────
  const verdictLabel   = lastVerdict?.final_verdict ?? null
  const verdictMet     = verdictLabel === 'BUY' || verdictLabel === 'HOLD'
  const verdictPartial = verdictLabel === null
  conditions.push({
    label:   'Signal verdict',
    met:     verdictMet,
    partial: verdictPartial,
    detail:  lastVerdict
      ? `Last verdict: ${verdictLabel} (${((lastVerdict.confidence ?? 0) * 100).toFixed(0)}% conf)`
      : 'No verdict yet — run analysis to get a signal',
  })

  // ── 6. Estimate revisions not down ───────────────────────────────────────────
  const revisions     = fundamentals?.estimateRevisions ?? null
  const revMet        = revisions === 'up'
  const revPartial    = revisions === 'flat' || revisions === null
  conditions.push({
    label:   'Estimate revisions',
    met:     revMet,
    partial: revPartial,
    detail:  revisions
      ? revisions === 'up'
        ? 'Analyst estimates rising — fundamental tailwind'
        : revisions === 'down'
        ? 'Analyst estimates falling — watch for thesis deterioration'
        : 'Estimates flat — no directional signal'
      : 'No estimate data available',
  })

  // ── Totals ────────────────────────────────────────────────────────────────────
  const totalScore = parseFloat(conditions.reduce((s, c) => s + points(c), 0).toFixed(1))
  const str        = strength(totalScore)
  const action     = holdAction(totalScore)

  // ── Reasoning ────────────────────────────────────────────────────────────────
  const metLabels  = conditions.filter((c) => c.met).map((c) => c.label)
  const failLabels = conditions.filter((c) => !c.met && !c.partial).map((c) => c.label)

  let reasoning = `${position.ticker} health score: ${totalScore.toFixed(1)}/6.`
  if (metLabels.length > 0)  reasoning += ` Healthy: ${metLabels.join(', ')}.`
  if (failLabels.length > 0) reasoning += ` Flags: ${failLabels.join(', ')}.`
  if (pnlPct < -15) reasoning += ` Position is down ${Math.abs(pnlPct).toFixed(1)}% — review your original stop loss.`
  if (factorScore < 4) reasoning += ` Conviction score has fallen below 4 — thesis may be deteriorating.`
  if (lastVerdict?.reasoning) reasoning += ` AI: ${lastVerdict.reasoning.slice(0, 150)}…`

  const headline =
    action === 'HOLD'   ? `${totalScore.toFixed(1)}/6 — thesis intact, continue holding` :
    action === 'REVIEW' ? `${totalScore.toFixed(1)}/6 — weakening, review your thesis` :
                          `${totalScore.toFixed(1)}/6 — multiple flags, consider exiting`

  return {
    ticker:      position.ticker,
    name:        position.name,
    type:        'position',
    action,
    strength:    str,
    score:       totalScore,
    maxScore:    6,
    conditions,
    headline,
    reasoning,
    verdict:     lastVerdict?.final_verdict ?? undefined,
    verdictConf: lastVerdict?.confidence    ?? undefined,
    price:       livePrice,
    pnlPct,
    scoredAt:    now,
  }
}
