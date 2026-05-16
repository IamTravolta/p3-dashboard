/**
 * Technical Analysis signal module
 *
 * Uses Stooq price history to compute:
 * - Trend: price vs 20-day and 50-day SMA
 * - Momentum: RSI(14)
 * - Volume: relative volume vs 20-day average
 * - Volatility: ATR(14)
 *
 * Returns a BULLISH / BEARISH / NEUTRAL signal with confidence.
 */

import { fetchStooqPrices, stooqSymbol } from '@/lib/utils/stooq'

export interface TechnicalSignal {
  value:      'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number
  reasoning:  string
  raw_data: {
    price:      number
    sma20:      number
    sma50:      number
    rsi14:      number
    relVolume:  number
    atr14:      number
    trend:      string
  }
}

// ── Fetch OHLCV history from Stooq ───────────────────────────────────────────

async function fetchHistory(ticker: string, exchange: string): Promise<{ close: number; volume: number }[]> {
  const sym = stooqSymbol(ticker, exchange)
  const url = `https://stooq.com/q/d/l/?s=${sym}&i=d`   // daily OHLCV, last ~3 months

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next:    { revalidate: 300 },  // cache 5 min
    })
    if (!resp.ok) return []
    const csv  = await resp.text()
    const lines = csv.trim().split('\n').slice(1)  // skip header

    return lines
      .map((line) => {
        const cols  = line.split(',')
        const close  = parseFloat(cols[4] ?? '')
        const volume = parseInt(cols[5]   ?? '0', 10)
        return { close, volume }
      })
      .filter((r) => !isNaN(r.close) && r.close > 0)
  } catch {
    return []
  }
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function sma(values: number[], period: number): number {
  if (values.length < period) return values.reduce((a, b) => a + b, 0) / values.length
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50  // neutral fallback

  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains  += diff
    else          losses -= diff
  }
  const avgGain = gains  / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

function atr(history: { close: number }[], period = 14): number {
  if (history.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < history.length; i++) {
    trs.push(Math.abs(history[i].close - history[i - 1].close))
  }
  return sma(trs, Math.min(period, trs.length))
}

// ── Main function ────────────────────────────────────────────────────────────

export async function getTechnicalSignal(ticker: string, exchange: string): Promise<TechnicalSignal> {
  const history = await fetchHistory(ticker, exchange)

  if (history.length < 20) {
    // Fall back to single-quote check
    const quotes = await fetchStooqPrices([{ ticker, exchange }])
    const q = quotes[ticker]
    return {
      value:      'NEUTRAL',
      confidence: 0.30,
      reasoning:  'Insufficient price history for technical analysis.',
      raw_data:   { price: q?.price ?? 0, sma20: 0, sma50: 0, rsi14: 50, relVolume: 1, atr14: 0, trend: 'unknown' },
    }
  }

  const closes  = history.map((h) => h.close)
  const volumes = history.map((h) => h.volume)

  const price   = closes[closes.length - 1]
  const s20     = sma(closes, 20)
  const s50     = sma(closes, Math.min(50, closes.length))
  const rsi14   = rsi(closes)
  const atr14   = atr(history)
  const vol20   = sma(volumes, Math.min(20, volumes.length))
  const relVol  = vol20 > 0 ? (volumes[volumes.length - 1] / vol20) : 1

  // ── Scoring ────────────────────────────────────────────────────────────────
  let score = 0  // -3 to +3

  // Trend: price vs SMA20 and SMA50
  if (price > s20) score += 1
  else             score -= 1
  if (price > s50) score += 1
  else             score -= 1

  // Momentum: RSI
  if (rsi14 > 60)      score += 1
  else if (rsi14 < 40) score -= 1

  // Volume confirmation
  const volScore = relVol > 1.5 ? (score > 0 ? 0.5 : -0.5) : 0
  score += volScore

  const trend = price > s20 && price > s50 ? 'uptrend'
    : price < s20 && price < s50 ? 'downtrend'
    : 'sideways'

  // ── Map score to signal ────────────────────────────────────────────────────
  let value:      TechnicalSignal['value']
  let confidence: number

  if (score >= 2) {
    value      = 'BULLISH'
    confidence = Math.min(0.85, 0.50 + score * 0.10)
  } else if (score <= -2) {
    value      = 'BEARISH'
    confidence = Math.min(0.85, 0.50 + Math.abs(score) * 0.10)
  } else {
    value      = 'NEUTRAL'
    confidence = 0.40
  }

  const reasoning = [
    `Price €${price.toFixed(2)} is ${price > s20 ? 'above' : 'below'} 20-day SMA (€${s20.toFixed(2)}).`,
    `${price > s50 ? 'Above' : 'Below'} 50-day SMA (€${s50.toFixed(2)}) — ${trend}.`,
    `RSI(14): ${rsi14.toFixed(1)} — ${rsi14 > 70 ? 'overbought' : rsi14 < 30 ? 'oversold' : 'neutral range'}.`,
    relVol > 1.5 ? `Volume ${relVol.toFixed(1)}× above average — confirms move.` : `Volume near average (${relVol.toFixed(1)}×).`,
  ].join(' ')

  return {
    value,
    confidence,
    reasoning,
    raw_data: { price, sma20: s20, sma50: s50, rsi14, relVolume: relVol, atr14, trend },
  }
}
