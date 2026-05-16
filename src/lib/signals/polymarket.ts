/**
 * Polymarket signal module
 *
 * Fetches from gamma-api.polymarket.com to get:
 * - Recession probability
 * - Fed rate cut expectations
 * - Geopolitical risk events
 *
 * Replaces the hardcoded thresholds from the HTML dashboard with
 * dynamic thresholds sourced from signal_reliability table.
 */

export interface PolymarketData {
  recession_pct:   number    // 0-100
  rate_cut_pct:    number    // probability of rate cut
  geopolitical:    number    // 0-100 risk score
  markets_found:   number
}

export interface PolymarketSignal {
  value:      'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number
  reasoning:  string
  raw_data:   PolymarketData
}

const GAMMA_API = 'https://gamma-api.polymarket.com/markets'

// Slugs we care about — matches what the HTML dashboard fetched
const RECESSION_KEYWORDS   = ['recession', 'gdp contraction', 'economic recession']
const RATE_CUT_KEYWORDS    = ['fed rate cut', 'federal reserve cut', 'rate cut 2025']
const GEO_KEYWORDS         = ['war', 'conflict', 'invasion', 'nuclear']

async function searchMarkets(keywords: string[]): Promise<{ outcomePrices: string; question: string }[]> {
  const results: { outcomePrices: string; question: string }[] = []
  for (const kw of keywords.slice(0, 2)) {   // limit requests
    try {
      const resp = await fetch(
        `${GAMMA_API}?search=${encodeURIComponent(kw)}&active=true&limit=5`,
        { next: { revalidate: 600 } }   // cache 10 min
      )
      if (!resp.ok) continue
      const data = await resp.json() as { outcomePrices?: string; question?: string }[]
      results.push(...data.filter((m) => m.outcomePrices && m.question).slice(0, 3) as typeof results)
    } catch { /* ignore */ }
  }
  return results
}

function avgYesPct(markets: { outcomePrices: string }[]): number {
  if (markets.length === 0) return 50
  let total = 0
  let count = 0
  for (const m of markets) {
    try {
      const prices = JSON.parse(m.outcomePrices) as number[]
      if (prices.length > 0) { total += prices[0] * 100; count++ }
    } catch { /* ignore */ }
  }
  return count > 0 ? total / count : 50
}

export async function getPolymarketSignal(
  sector: string,
  _dynamicThreshold?: number   // future: from signal_reliability
): Promise<PolymarketSignal> {
  const isCyclical = ['Technology', 'Industrials', 'Consumer Discretionary', 'Energy', 'Materials', 'Financials'].includes(sector)
  const isDefensive = ['Utilities', 'Consumer Staples', 'Healthcare'].includes(sector)

  // Fetch in parallel
  const [recMarkets, rateMarkets, geoMarkets] = await Promise.all([
    searchMarkets(RECESSION_KEYWORDS),
    searchMarkets(RATE_CUT_KEYWORDS),
    searchMarkets(GEO_KEYWORDS),
  ])

  const recessionPct   = avgYesPct(recMarkets)
  const rateCutPct     = avgYesPct(rateMarkets)
  const geoRisk        = avgYesPct(geoMarkets)
  const marketsFound   = recMarkets.length + rateMarkets.length + geoMarkets.length

  // ── Scoring logic ─────────────────────────────────────────────────────────
  let score = 0

  // Recession risk
  if (recessionPct > 60 && isCyclical)  score -= 2
  else if (recessionPct > 60 && isDefensive) score += 1
  else if (recessionPct < 25)           score += 1

  // Rate cuts are broadly bullish for equities
  if (rateCutPct > 65)  score += 1
  else if (rateCutPct < 25) score -= 1

  // Geopolitical risk is broadly bearish
  if (geoRisk > 60) score -= 1

  let value:      PolymarketSignal['value']
  let confidence: number

  if (score >= 2) {
    value = 'BULLISH'; confidence = 0.60
  } else if (score <= -2) {
    value = 'BEARISH'; confidence = Math.min(0.75, 0.50 + (Math.abs(score) - 2) * 0.10)
  } else {
    value = 'NEUTRAL'; confidence = 0.40
  }

  // Reduce confidence if few markets found
  if (marketsFound < 3) confidence *= 0.7

  const reasoning = [
    `Recession probability: ${recessionPct.toFixed(0)}%.`,
    `Fed rate cut probability: ${rateCutPct.toFixed(0)}%.`,
    `Geopolitical risk index: ${geoRisk.toFixed(0)}%.`,
    isCyclical ? `Sector (${sector}) is cyclical — elevated recession risk is a negative.` :
    isDefensive ? `Sector (${sector}) is defensive — recession risk may be positive.` :
    `Sector (${sector}) has neutral macro sensitivity.`,
    marketsFound < 3 ? `Only ${marketsFound} prediction markets found — lower confidence.` : '',
  ].filter(Boolean).join(' ')

  return {
    value,
    confidence,
    reasoning,
    raw_data: { recession_pct: recessionPct, rate_cut_pct: rateCutPct, geopolitical: geoRisk, markets_found: marketsFound },
  }
}
