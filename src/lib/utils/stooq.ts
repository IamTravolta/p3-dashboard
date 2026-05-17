/**
 * Stooq price fetcher
 *
 * Replicates the exact logic from the HTML dashboard's fetchLiveQuotesViaStooq().
 * Stooq CSV format with f=sd2t2ohlcvp:
 *   col[0] = symbol
 *   col[1] = date (YYYYMMDD)
 *   col[2] = time (HHMMSS)
 *   col[3] = open
 *   col[4] = high
 *   col[5] = low
 *   col[6] = close  ← price we use
 *   col[7] = volume
 *   col[8] = prevClose ← previous session close (p format code)
 *
 * Exchange suffix mapping (same as HTML dashboard):
 *   NYSE / NASDAQ / AMEX   → no suffix  (e.g. AAPL)
 *   LSE                    → .UK        (e.g. SHEL.UK)
 *   AMS / EURONEXT         → .NL
 *   XETRA                  → .DE
 *   EPA                    → .FR
 *   TSX                    → .CA
 */

export interface StooqQuote {
  ticker:    string
  price:     number
  prevClose: number  // previous session close — used for day change
  open:      number
  high:      number
  low:       number
  volume:    number
  date:      string  // YYYYMMDD
  time:      string  // HHMMSS
  stale:     boolean // true if market is closed / no data
}

export type StooqQuoteMap = Record<string, StooqQuote>

// ── Exchange → Stooq suffix ─────────────────────────────────────────────────

const EXCHANGE_SUFFIX: Record<string, string> = {
  'NYSE':      '',
  'NASDAQ':    '',
  'AMEX':      '',
  'LSE':       '.UK',
  'AMS':       '.NL',
  'EURONEXT':  '.NL',
  'XETRA':     '.DE',
  'EPA':       '.FR',
  'TSX':       '.CA',
  'ASX':       '.AU',
  'HKG':       '.HK',
  'TYO':       '.JP',
}

export function stooqSymbol(ticker: string, exchange: string): string {
  const suffix = EXCHANGE_SUFFIX[exchange.toUpperCase()] ?? ''
  return `${ticker.toLowerCase()}${suffix}`
}

// ── Batch fetcher ────────────────────────────────────────────────────────────

const BATCH_SIZE = 40    // Stooq allows ~50 symbols per request; use 40 for safety
const STOOQ_BASE = 'https://stooq.com/q/l/?f=sd2t2ohlcvp&h&e=csv&s='  // p = prev close

export async function fetchStooqPrices(
  items: Array<{ ticker: string; exchange: string }>
): Promise<StooqQuoteMap> {
  if (items.length === 0) return {}

  const result: StooqQuoteMap = {}

  // Build symbol → original ticker map
  const symbolMap: Record<string, string> = {}
  for (const { ticker, exchange } of items) {
    symbolMap[stooqSymbol(ticker, exchange)] = ticker
  }

  const symbols = Object.keys(symbolMap)

  // Fetch in batches
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    const url = `${STOOQ_BASE}${batch.join(',')}`

    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },   // never cache — always fresh
      })

      if (!resp.ok) continue

      const csv = await resp.text()
      const lines = csv.trim().split('\n')

      // Skip header line
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j].trim()
        if (!line) continue

        const cols = line.split(',')
        if (cols.length < 7) continue

        const stooqSym = cols[0].toLowerCase()
        const originalTicker = symbolMap[stooqSym] ?? stooqSym.toUpperCase()

        const close     = parseFloat(cols[6])
        const open      = parseFloat(cols[3])
        const high      = parseFloat(cols[4])
        const low       = parseFloat(cols[5])
        const volume    = parseInt(cols[7] ?? '0', 10)
        const prevClose = parseFloat(cols[8] ?? 'NaN')  // col[8] = p (prev close)

        // Stooq returns 'N/D' or 0 for missing data
        const stale = isNaN(close) || close === 0

        result[originalTicker] = {
          ticker:    originalTicker,
          price:     stale ? 0 : close,
          prevClose: isNaN(prevClose) ? 0 : prevClose,
          open:      isNaN(open)   ? 0 : open,
          high:      isNaN(high)   ? 0 : high,
          low:       isNaN(low)    ? 0 : low,
          volume:    isNaN(volume) ? 0 : volume,
          date:      cols[1] ?? '',
          time:      cols[2] ?? '',
          stale,
        }
      }
    } catch (err) {
      console.error(`[stooq] fetch error for batch starting at ${i}:`, err)
    }
  }

  return result
}
