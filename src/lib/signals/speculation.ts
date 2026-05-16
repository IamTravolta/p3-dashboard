/**
 * Speculation score module
 *
 * Generates a 0–10 speculation score based on:
 * - RSI momentum (higher = more speculative)
 * - Relative volume spike
 * - ATR-based volatility vs price
 * - Beta proxy (sector-based, since we have no options data)
 *
 * High score = speculative / momentum play
 * Low score  = stable / value characteristics
 */

import { fetchStooqPrices } from '@/lib/utils/stooq'

export interface SpeculationScore {
  score:      number   // 0–10
  label:      'Conservative' | 'Moderate' | 'Aggressive' | 'Speculative'
  confidence: number
  factors: {
    momentum:   number   // 0–10
    volatility: number   // 0–10
    volume:     number   // 0–10
    beta_proxy: number   // 0–10
  }
  reasoning:  string
}

// Sector beta proxies (rough estimates, 1.0 = market)
const SECTOR_BETA: Record<string, number> = {
  'Technology':              1.5,
  'Consumer Discretionary':  1.3,
  'Financials':              1.2,
  'Energy':                  1.2,
  'Materials':               1.1,
  'Industrials':             1.0,
  'Communication Services':  1.0,
  'Real Estate':             0.9,
  'Healthcare':              0.8,
  'Consumer Staples':        0.6,
  'Utilities':               0.5,
}

function clamp(v: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, v))
}

export async function getSpeculationScore(
  ticker:   string,
  exchange: string,
  sector:   string,
  rsi14:    number,
  relVolume: number,
  atr14:    number,
  price:    number,
): Promise<SpeculationScore> {
  // ── Beta proxy ──────────────────────────────────────────────────────────────
  const beta = SECTOR_BETA[sector] ?? 1.0
  const betaScore = clamp((beta - 0.5) / 1.2 * 10)   // 0.5→0, 1.7→10

  // ── Momentum (RSI-based) ─────────────────────────────────────────────────────
  // RSI 80 → 10, RSI 50 → 5, RSI 20 → 0
  const momentumScore = clamp((rsi14 - 20) / 6)

  // ── Volatility (ATR / price) ─────────────────────────────────────────────────
  const atrPct = price > 0 ? (atr14 / price) * 100 : 0   // daily ATR as % of price
  // 0.5% = low, 3% = very high
  const volatilityScore = clamp(atrPct / 0.3)

  // ── Volume (relative) ────────────────────────────────────────────────────────
  // 1× = 3/10, 2× = 6/10, 3× = 9/10
  const volumeScore = clamp((relVolume - 0.5) * 3.3)

  const raw = (momentumScore * 0.30 + volatilityScore * 0.30 + betaScore * 0.25 + volumeScore * 0.15)
  const score = clamp(parseFloat(raw.toFixed(1)))

  let label: SpeculationScore['label']
  if (score < 3)       label = 'Conservative'
  else if (score < 5)  label = 'Moderate'
  else if (score < 7.5) label = 'Aggressive'
  else                 label = 'Speculative'

  // Fetch quote just to confirm ticker exists (best-effort)
  let confidence = 0.70
  try {
    const q = await fetchStooqPrices([{ ticker, exchange }])
    if (!q[ticker]) confidence = 0.40
  } catch { confidence = 0.50 }

  const reasoning = [
    `Speculation score ${score.toFixed(1)}/10 (${label}).`,
    `Momentum (RSI ${rsi14.toFixed(0)}): ${momentumScore.toFixed(1)}/10.`,
    `Volatility (ATR ${atrPct.toFixed(2)}% of price): ${volatilityScore.toFixed(1)}/10.`,
    `Volume (${relVolume.toFixed(1)}× avg): ${volumeScore.toFixed(1)}/10.`,
    `Sector beta proxy (${sector}): ${beta.toFixed(1)}× → ${betaScore.toFixed(1)}/10.`,
  ].join(' ')

  return {
    score,
    label,
    confidence,
    factors: {
      momentum:   parseFloat(momentumScore.toFixed(1)),
      volatility: parseFloat(volatilityScore.toFixed(1)),
      volume:     parseFloat(volumeScore.toFixed(1)),
      beta_proxy: parseFloat(betaScore.toFixed(1)),
    },
    reasoning,
  }
}
