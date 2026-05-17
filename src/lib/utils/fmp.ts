/**
 * Financial Modeling Prep (FMP) utility
 *
 * Covers: earnings calendar, earnings surprise history, financial statements,
 * analyst price targets, and estimate revisions.
 *
 * Free tier: 250 calls/day — responses are cached via Next.js fetch revalidation.
 */

const BASE = 'https://financialmodelingprep.com/api'
const KEY  = process.env.FMP_API_KEY ?? ''

async function fmpFetch<T>(path: string, ttlSeconds = 3600): Promise<T | null> {
  if (!KEY) {
    console.warn('[FMP] FMP_API_KEY not set')
    return null
  }
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}apikey=${KEY}`
  try {
    const resp = await fetch(url, { next: { revalidate: ttlSeconds } })
    if (!resp.ok) return null
    const data = await resp.json()
    // FMP returns { "Error Message": "..." } on bad key / limit exceeded
    if (data && typeof data === 'object' && 'Error Message' in data) {
      console.error('[FMP] API error:', data['Error Message'])
      return null
    }
    return data as T
  } catch (err) {
    console.error('[FMP] fetch error:', err)
    return null
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EarningsCalendarItem {
  date:              string   // "2025-07-24"
  symbol:            string
  eps:               number | null
  epsEstimated:      number | null
  revenue:           number | null
  revenueEstimated:  number | null
  time:              string   // "amc" | "bmo" | "dmh"
}

export interface EarningsSurprise {
  date:              string
  symbol:            string
  actualEarningResult: number
  estimatedEarning:  number
}

export interface KeyMetrics {
  symbol:            string
  date:              string
  peRatio:           number | null
  priceToSalesRatio: number | null
  evToEbitda:        number | null
  debtToEquity:      number | null
  returnOnEquity:    number | null
  netProfitMargin:   number | null
  revenueGrowth:     number | null   // YoY
  freeCashFlowPerShare: number | null
}

export interface AnalystEstimate {
  symbol:              string
  date:                string
  estimatedRevenueAvg: number
  estimatedEpsAvg:     number
  numberAnalystEstimated: number
}

export interface AnalystRating {
  symbol:      string
  date:        string
  rating:      string   // "S" | "B" | "N" | "U" | "SU"
  ratingScore: number
  ratingRecommendation: string   // "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
  ratingDetailsBUScore: number
  ratingDetailsSScore: number
}

export interface FundamentalsBundle {
  earningsDate:     string | null   // ISO date of next earnings
  daysToEarnings:   number | null
  earningsTime:     string | null   // "amc" | "bmo"
  surpriseHistory:  Array<{
    date:     string
    beat:     boolean
    epsMiss:  number   // actual - estimate (negative = miss)
    revenueMiss: number
  }>
  peRatio:          number | null
  evToEbitda:       number | null
  revenueGrowthYoY: number | null
  netMargin:        number | null
  debtToEquity:     number | null
  analystTarget:    number | null
  analystConsensus: string | null   // "Strong Buy" | "Buy" | "Neutral" | "Sell"
  analystCount:     number | null
  estimateRevisions: 'up' | 'down' | 'flat' | null
}

// ── Public functions ──────────────────────────────────────────────────────────

/** Next earnings date + time for a ticker */
export async function getNextEarnings(ticker: string): Promise<{ date: string; time: string } | null> {
  const from = new Date().toISOString().slice(0, 10)
  const to   = new Date(Date.now() + 90 * 86400 * 1000).toISOString().slice(0, 10)
  const data = await fmpFetch<EarningsCalendarItem[]>(
    `/v3/earning_calendar?from=${from}&to=${to}`,
    1800,  // 30 min cache — earnings dates change
  )
  if (!data) return null
  const match = data
    .filter((e) => e.symbol === ticker.toUpperCase())
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  return match ? { date: match.date, time: match.time } : null
}

/** Last 4 quarters of earnings surprise (beat/miss) */
export async function getEarningsSurprise(ticker: string): Promise<FundamentalsBundle['surpriseHistory']> {
  const data = await fmpFetch<EarningsSurprise[]>(
    `/v3/earnings-surprises/${ticker.toUpperCase()}`,
    7200,
  )
  if (!data || !Array.isArray(data)) return []

  return data.slice(0, 4).map((s) => {
    const epsMiss = (s.actualEarningResult ?? 0) - (s.estimatedEarning ?? 0)
    return {
      date:        s.date,
      beat:        epsMiss >= 0,
      epsMiss:     parseFloat(epsMiss.toFixed(3)),
      revenueMiss: 0,   // revenue surprise not in this endpoint
    }
  })
}

/** Key financial metrics (TTM) */
export async function getKeyMetrics(ticker: string): Promise<KeyMetrics | null> {
  const data = await fmpFetch<KeyMetrics[]>(
    `/v3/key-metrics-ttm/${ticker.toUpperCase()}?limit=1`,
    7200,
  )
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/** Latest analyst rating + consensus */
export async function getAnalystRating(ticker: string): Promise<AnalystRating | null> {
  const data = await fmpFetch<AnalystRating[]>(
    `/v3/analyst-stock-recommendations/${ticker.toUpperCase()}?limit=1`,
    3600,
  )
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/** Analyst price target */
export async function getAnalystPriceTarget(ticker: string): Promise<number | null> {
  const data = await fmpFetch<Array<{ targetConsensus: number }>>(
    `/v4/analyst-price-targets-summary?symbol=${ticker.toUpperCase()}`,
    3600,
  )
  return Array.isArray(data) && data.length > 0 ? (data[0].targetConsensus ?? null) : null
}

/** Analyst estimate revisions — are estimates trending up or down? */
export async function getEstimateRevisions(ticker: string): Promise<'up' | 'down' | 'flat' | null> {
  const data = await fmpFetch<AnalystEstimate[]>(
    `/v3/analyst-estimates/${ticker.toUpperCase()}?limit=4`,
    3600,
  )
  if (!Array.isArray(data) || data.length < 2) return null
  const latest = data[0].estimatedEpsAvg
  const prior  = data[1].estimatedEpsAvg
  if (prior === 0) return 'flat'
  const change = (latest - prior) / Math.abs(prior)
  if (change >  0.01) return 'up'
  if (change < -0.01) return 'down'
  return 'flat'
}

/** Full bundle — single call from the API route */
export async function getFundamentalsBundle(ticker: string): Promise<FundamentalsBundle> {
  const sym = ticker.toUpperCase()

  const [nextEarnings, surprises, metrics, rating, target, revisions] = await Promise.all([
    getNextEarnings(sym),
    getEarningsSurprise(sym),
    getKeyMetrics(sym),
    getAnalystRating(sym),
    getAnalystPriceTarget(sym),
    getEstimateRevisions(sym),
  ])

  const daysToEarnings = nextEarnings
    ? Math.ceil((new Date(nextEarnings.date).getTime() - Date.now()) / 86400000)
    : null

  return {
    earningsDate:     nextEarnings?.date    ?? null,
    daysToEarnings,
    earningsTime:     nextEarnings?.time    ?? null,
    surpriseHistory:  surprises,
    peRatio:          metrics?.peRatio      ?? null,
    evToEbitda:       metrics?.evToEbitda   ?? null,
    revenueGrowthYoY: metrics?.revenueGrowth ?? null,
    netMargin:        metrics?.netProfitMargin ?? null,
    debtToEquity:     metrics?.debtToEquity ?? null,
    analystTarget:    target,
    analystConsensus: rating?.ratingRecommendation ?? null,
    analystCount:     null,
    estimateRevisions: revisions,
  }
}
