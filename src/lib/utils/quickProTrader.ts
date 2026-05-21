/**
 * Quick Pro Trader — rule-based analysis (no API call, instant)
 *
 * Mirrors computeQuickProTrader() from the HTML reference.
 * Uses available signal cache, position data, and factor scores
 * to generate entry/stop/target levels and a concrete action.
 */

import type { Position, WatchlistItem } from '@/lib/types/database'

export type QuickAction = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'TRIM' | 'EXIT' | 'AVOID'

export interface QuickProTraderResult {
  action:             QuickAction
  entry_level:        number
  stop_loss:          number
  take_profit_1:      number
  take_profit_2:      number
  risk_reward_ratio:  number
  position_size_pct:  number
  confidence:         number
  time_horizon:       string
  key_risk:           string
  key_catalyst:       string
  one_liner:          string
  // Concrete execution
  trim_shares:        number | null
  trim_eur:           number | null
  trim_pct:           number | null
  keep_shares:        number | null
  buy_shares:         number | null
  buy_eur:            number | null
  current_shares:     number | null
  current_weight:     number
  source:             'quick'
}

export function computeQuickProTrader(
  ticker:        string,
  livePrice:     number,
  positions:     Position[],
  watchlist:     WatchlistItem[],
  prices:        Record<string, number>,
  verdict?: { finalVerdict: string; confidence: number } | null,
): QuickProTraderResult | null {
  if (!livePrice || livePrice <= 0) return null

  const owned   = positions.find((p) => p.ticker === ticker)
  const watched = watchlist.find((w) => w.ticker === ticker)

  // Portfolio total (for weight calc)
  const portfolioVal = positions.reduce(
    (s, p) => s + (prices[p.ticker] ?? p.currentPrice) * p.shares, 0,
  )
  const currentWeight = owned && portfolioVal > 0
    ? ((prices[owned.ticker] ?? owned.currentPrice) * owned.shares / portfolioVal) * 100
    : 0

  // ── Stop loss: 8% below current price (conservative default without ATR) ─
  const stop_loss       = Math.round(livePrice * 0.92 * 100) / 100
  // ── Take profit 1: 8% above entry ─────────────────────────────────────────
  const take_profit_1   = Math.round(livePrice * 1.08 * 100) / 100
  // ── Take profit 2: 10% extension of TP1 ──────────────────────────────────
  const take_profit_2   = Math.round(take_profit_1 * 1.10 * 100) / 100

  const risk   = livePrice - stop_loss
  const reward = take_profit_1 - livePrice
  const risk_reward_ratio = risk > 0 ? Math.round((reward / risk) * 10) / 10 : 0

  // ── Confidence from verdict or factor scores ───────────────────────────────
  const rawConf   = verdict?.confidence ?? 60
  const confidence = Math.max(40, Math.min(95, rawConf))

  // ── Kelly position sizing ─────────────────────────────────────────────────
  const conf = confidence / 100
  const kelly = Math.max(0, Math.min(0.08,
    (conf * (risk_reward_ratio || 1) - (1 - conf)) / (risk_reward_ratio || 1),
  ))
  let position_size_pct = Math.round(kelly * 100 * 10) / 10
  if (position_size_pct > 8)  position_size_pct = 8
  if (position_size_pct < 1)  position_size_pct = 1

  // ── Action from verdict or factor scores ──────────────────────────────────
  let action: QuickAction = 'HOLD'
  const v = verdict?.finalVerdict ?? ''
  if      (v === 'VERKOPEN')           action = 'EXIT'
  else if (v === 'AFBOUWEN')           action = 'TRIM'
  else if (v === 'HOUDEN')             action = 'HOLD'
  else if (v === 'GEFASEERD_KOPEN')    action = 'BUY'
  else if (v === 'WATCHLIST_TOEVOEGEN')action = 'BUY'
  else if (v === 'GEEN_ACTIE')         action = 'AVOID'
  else {
    // Fall back to confidence-based heuristic
    if (confidence >= 75)      action = 'BUY'
    else if (confidence >= 60) action = 'HOLD'
    else                       action = 'AVOID'
  }

  // STRONG_BUY upgrade if high confidence
  if (action === 'BUY' && confidence >= 80) action = 'STRONG_BUY'

  // TRIM fix: target must be lower than current weight
  if (owned && currentWeight > 0 && action === 'TRIM') {
    if (position_size_pct >= currentWeight) {
      position_size_pct = Math.max(1, Math.round(currentWeight * 0.5 * 10) / 10)
    }
  }

  // ── Concrete execution amounts ────────────────────────────────────────────
  let trim_shares: number | null = null
  let trim_eur:    number | null = null
  let trim_pct:    number | null = null
  let keep_shares: number | null = null
  let buy_shares:  number | null = null
  let buy_eur:     number | null = null

  if (owned) {
    if (action === 'EXIT') {
      trim_shares = owned.shares
      trim_eur    = Math.round(owned.shares * livePrice)
      trim_pct    = 100
      keep_shares = 0
    } else if (action === 'TRIM') {
      const targetShares = Math.round(owned.shares * (position_size_pct / currentWeight))
      trim_shares = Math.max(1, owned.shares - targetShares)
      keep_shares = owned.shares - trim_shares
      trim_eur    = Math.round(trim_shares * livePrice)
      trim_pct    = Math.round((trim_shares / owned.shares) * 100)
    }
  } else if (watched && (action === 'BUY' || action === 'STRONG_BUY')) {
    const targetEur = (portfolioVal * position_size_pct) / 100
    buy_shares = Math.max(1, Math.round(targetEur / livePrice))
    buy_eur    = Math.round(buy_shares * livePrice)
  }

  // ── Key risk ──────────────────────────────────────────────────────────────
  let key_risk = 'Market risk at current level'
  if (currentWeight > 8) {
    key_risk = `Overweight position (${currentWeight.toFixed(1)}%) — concentration risk`
  } else if (action === 'TRIM' || action === 'EXIT') {
    key_risk = 'Weakening signal profile — multiple bearish indicators'
  }

  // ── Key catalyst ──────────────────────────────────────────────────────────
  const key_catalyst = 'Follow general trend — no specific catalyst data'

  // ── Time horizon ──────────────────────────────────────────────────────────
  let time_horizon: string
  if (action === 'EXIT' || action === 'TRIM') time_horizon = 'Short-term (1–4w)'
  else if (confidence >= 75)                  time_horizon = 'Medium-term (1–3m)'
  else                                        time_horizon = 'Short-term (1–4w)'

  // ── One-liner ─────────────────────────────────────────────────────────────
  let one_liner: string
  if (action === 'STRONG_BUY') {
    if (buy_shares && buy_eur)
      one_liner = `Buy ${buy_shares} shares (~€${buy_eur.toLocaleString('nl-NL')}) — strong conviction, ${position_size_pct}% target position`
    else
      one_liner = `Strong conviction — build position gradually to ${position_size_pct}% allocation`
  } else if (action === 'BUY') {
    if (buy_shares && buy_eur)
      one_liner = `Buy ${buy_shares} shares (~€${buy_eur.toLocaleString('nl-NL')}) — R/R ${risk_reward_ratio}x, ${position_size_pct}% target`
    else
      one_liner = `Positive signals, R/R ${risk_reward_ratio}x — build position gradually`
  } else if (action === 'HOLD') {
    one_liner = `Neutral to positive signals, no action needed — hold${owned ? ` at ${currentWeight.toFixed(1)}%` : ''}`
  } else if (action === 'TRIM') {
    if (trim_shares && trim_eur)
      one_liner = `Sell ${trim_shares} of ${owned?.shares} shares (~€${trim_eur.toLocaleString('nl-NL')}, ${trim_pct}%) — take profit, keep ${keep_shares} shares`
    else
      one_liner = `Weakening signals — trim position, take partial profit`
  } else if (action === 'EXIT') {
    if (trim_shares && trim_eur)
      one_liner = `Sell ALL ${trim_shares} shares (~€${trim_eur.toLocaleString('nl-NL')}) — bearish signals, exit position fully`
    else
      one_liner = `Multiple bearish signals — exit full position`
  } else {
    one_liner = `No clear signal — avoid or wait for better entry`
  }

  return {
    action,
    entry_level:        Math.round(livePrice * 100) / 100,
    stop_loss,
    take_profit_1,
    take_profit_2,
    risk_reward_ratio,
    position_size_pct,
    confidence,
    time_horizon,
    key_risk,
    key_catalyst,
    one_liner,
    trim_shares,
    trim_eur,
    trim_pct,
    keep_shares,
    buy_shares,
    buy_eur,
    current_shares: owned?.shares ?? null,
    current_weight: Math.round(currentWeight * 10) / 10,
    source: 'quick',
  }
}
