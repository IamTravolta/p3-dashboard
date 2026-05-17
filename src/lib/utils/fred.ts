/**
 * FRED (Federal Reserve Economic Data) utility
 *
 * Covers: VIX, yield curve (2y-10y spread), fed funds rate, credit spreads.
 * Used to build a macro regime label injected into every verdict.
 *
 * FRED API docs: https://fred.stlouisfed.org/docs/api/fred/
 * Responses cached 4 hours — macro data doesn't need real-time precision.
 */

const BASE = 'https://api.stlouisfed.org/fred'
const KEY  = process.env.FRED_API_KEY ?? ''

// FRED series IDs
const SERIES = {
  VIX:          'VIXCLS',       // CBOE Volatility Index (daily)
  YIELD_10Y:    'GS10',         // 10-Year Treasury Constant Maturity Rate
  YIELD_2Y:     'GS2',          // 2-Year Treasury Constant Maturity Rate
  FED_FUNDS:    'FEDFUNDS',     // Effective Federal Funds Rate
  CREDIT_SPREAD: 'BAMLH0A0HYM2', // ICE BofA US High Yield Spread (OAS)
} as const

async function fredLatest(series: string): Promise<number | null> {
  if (!KEY) return null
  const url = `${BASE}/series/observations?series_id=${series}&api_key=${KEY}&file_type=json&limit=5&sort_order=desc`
  try {
    const resp = await fetch(url, { next: { revalidate: 14400 } }) // 4h cache
    if (!resp.ok) return null
    const json = await resp.json() as {
      observations: Array<{ date: string; value: string }>
    }
    // Find latest non-"." value
    const obs = (json.observations ?? []).find((o) => o.value !== '.')
    return obs ? parseFloat(obs.value) : null
  } catch (err) {
    console.error('[FRED] fetch error:', err)
    return null
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MacroRegime =
  | 'risk-on'        // VIX < 18, spread < 3.5%, curve normal
  | 'cautious'       // VIX 18–25, moderate spreads
  | 'risk-off'       // VIX > 25 or spread > 5%
  | 'crisis'         // VIX > 35 or spread > 7%

export interface MacroSnapshot {
  vix:            number | null
  yield10y:       number | null
  yield2y:        number | null
  yieldSpread:    number | null   // 10y minus 2y — negative = inverted
  fedFunds:       number | null
  creditSpread:   number | null   // HY OAS in %
  regime:         MacroRegime
  regimeSummary:  string          // human-readable 1-liner
  fetchedAt:      string
}

function classifyRegime(
  vix: number | null,
  creditSpread: number | null,
  yieldSpread: number | null,
): MacroRegime {
  const v = vix          ?? 20
  const s = creditSpread ?? 4
  if (v > 35 || s > 7)  return 'crisis'
  if (v > 25 || s > 5)  return 'risk-off'
  if (v > 18 || s > 3.5 || (yieldSpread !== null && yieldSpread < -0.25)) return 'cautious'
  return 'risk-on'
}

function buildSummary(snap: Omit<MacroSnapshot, 'regimeSummary'>): string {
  const parts: string[] = []
  if (snap.vix !== null)          parts.push(`VIX ${snap.vix.toFixed(1)}`)
  if (snap.yieldSpread !== null)  parts.push(`yield curve ${snap.yieldSpread >= 0 ? '+' : ''}${snap.yieldSpread.toFixed(2)}%`)
  if (snap.creditSpread !== null) parts.push(`HY spread ${snap.creditSpread.toFixed(2)}%`)
  if (snap.fedFunds !== null)     parts.push(`fed funds ${snap.fedFunds.toFixed(2)}%`)

  const regimeLabel: Record<MacroRegime, string> = {
    'risk-on':  'Risk-on — conditions support equities',
    'cautious': 'Cautious — elevated uncertainty, selective positioning',
    'risk-off': 'Risk-off — defensive posture warranted',
    'crisis':   'Crisis conditions — capital preservation priority',
  }

  return `${regimeLabel[snap.regime]}. ${parts.join(', ')}.`
}

// ── Public function ───────────────────────────────────────────────────────────

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const [vix, yield10y, yield2y, fedFunds, creditSpread] = await Promise.all([
    fredLatest(SERIES.VIX),
    fredLatest(SERIES.YIELD_10Y),
    fredLatest(SERIES.YIELD_2Y),
    fredLatest(SERIES.FED_FUNDS),
    fredLatest(SERIES.CREDIT_SPREAD),
  ])

  const yieldSpread = (yield10y !== null && yield2y !== null)
    ? parseFloat((yield10y - yield2y).toFixed(3))
    : null

  const regime = classifyRegime(vix, creditSpread, yieldSpread)

  const snap = { vix, yield10y, yield2y, yieldSpread, fedFunds, creditSpread, regime, fetchedAt: new Date().toISOString() }
  return { ...snap, regimeSummary: buildSummary(snap) }
}
