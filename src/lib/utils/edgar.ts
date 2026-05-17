/**
 * SEC EDGAR utility — insider transactions (Form 4)
 *
 * Uses the free, public EDGAR full-text search and data APIs.
 * No API key required.
 *
 * We use two endpoints:
 * 1. EDGAR company lookup (CIK from ticker)
 * 2. EDGAR submissions API (recent Form 4 filings)
 *
 * Docs: https://www.sec.gov/developer
 */

const HEADERS = {
  'User-Agent': 'P3Dashboard research@p3dashboard.app',  // required by SEC
  'Accept-Encoding': 'gzip, deflate',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InsiderTransaction {
  filedAt:          string   // ISO date
  insiderName:      string
  insiderTitle:     string
  transactionType:  'buy' | 'sell' | 'option' | 'other'
  shares:           number
  pricePerShare:    number | null
  totalValue:       number | null
  sharesOwned:      number | null
  formUrl:          string
}

export interface InsiderSummary {
  ticker:        string
  transactions:  InsiderTransaction[]
  netBuySignal:  'strong-buy' | 'buy' | 'neutral' | 'sell' | 'unknown'
  summary:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCIK(ticker: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${ticker.toUpperCase()}%22&dateRange=custom&startdt=2020-01-01&forms=10-K`,
      { headers: HEADERS, next: { revalidate: 86400 } },
    )
    // Use the company_tickers.json approach instead — more reliable
    const mapResp = await fetch(
      'https://www.sec.gov/files/company_tickers.json',
      { headers: HEADERS, next: { revalidate: 86400 } },
    )
    if (!mapResp.ok) return null
    const map = await mapResp.json() as Record<string, { cik_str: number; ticker: string; title: string }>
    const entry = Object.values(map).find(
      (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
    )
    if (!entry) return null
    // CIK must be zero-padded to 10 digits
    return String(entry.cik_str).padStart(10, '0')
  } catch (err) {
    console.error('[EDGAR] getCIK error:', err)
    return null
  }
}

function parseTransactionCode(code: string): InsiderTransaction['transactionType'] {
  // P = open-market purchase, S = sale, M = option exercise, etc.
  if (code === 'P') return 'buy'
  if (code === 'S') return 'sell'
  if (['M', 'C', 'X'].includes(code)) return 'option'
  return 'other'
}

function buildSignal(txns: InsiderTransaction[]): InsiderSummary['netBuySignal'] {
  if (txns.length === 0) return 'unknown'
  const openMarket = txns.filter((t) => t.transactionType === 'buy' || t.transactionType === 'sell')
  if (openMarket.length === 0) return 'neutral'

  const buyValue  = openMarket.filter((t) => t.transactionType === 'buy').reduce((s, t)  => s + (t.totalValue ?? 0), 0)
  const sellValue = openMarket.filter((t) => t.transactionType === 'sell').reduce((s, t) => s + (t.totalValue ?? 0), 0)

  const ratio = buyValue / (buyValue + sellValue + 1)
  if (ratio > 0.75 && buyValue > 50_000)  return 'strong-buy'
  if (ratio > 0.50)                        return 'buy'
  if (ratio < 0.20)                        return 'sell'
  return 'neutral'
}

function buildSummaryText(txns: InsiderTransaction[], signal: InsiderSummary['netBuySignal']): string {
  if (txns.length === 0) return 'No insider activity in the past 90 days.'
  const buys  = txns.filter((t) => t.transactionType === 'buy')
  const sells = txns.filter((t) => t.transactionType === 'sell')
  const parts: string[] = []
  if (buys.length > 0) {
    const total = buys.reduce((s, t) => s + (t.totalValue ?? 0), 0)
    parts.push(`${buys.length} open-market buy${buys.length > 1 ? 's' : ''} (≈$${(total / 1000).toFixed(0)}k)`)
  }
  if (sells.length > 0) {
    const total = sells.reduce((s, t) => s + (t.totalValue ?? 0), 0)
    parts.push(`${sells.length} sale${sells.length > 1 ? 's' : ''} (≈$${(total / 1000).toFixed(0)}k)`)
  }
  const labels: Record<InsiderSummary['netBuySignal'], string> = {
    'strong-buy': 'Strong cluster buy — executives buying heavily on open market.',
    'buy':        'Net insider buying — positive internal signal.',
    'neutral':    'Mixed insider activity — no clear directional signal.',
    'sell':       'Net insider selling — executives reducing exposure.',
    'unknown':    'No insider data available.',
  }
  return `${parts.join(', ')}. ${labels[signal]}`
}

// ── Public function ───────────────────────────────────────────────────────────

export async function getInsiderTransactions(ticker: string): Promise<InsiderSummary> {
  const empty: InsiderSummary = {
    ticker,
    transactions: [],
    netBuySignal: 'unknown',
    summary: 'No insider data available.',
  }

  try {
    const cik = await getCIK(ticker)
    if (!cik) return empty

    const resp = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { headers: HEADERS, next: { revalidate: 3600 } },
    )
    if (!resp.ok) return empty

    const data = await resp.json() as {
      filings: {
        recent: {
          form:           string[]
          filingDate:     string[]
          accessionNumber: string[]
          primaryDocument: string[]
        }
      }
    }

    const { form, filingDate, accessionNumber, primaryDocument } = data.filings.recent

    // Find Form 4 filings from last 90 days
    const cutoff = Date.now() - 90 * 86400 * 1000
    const form4Indices: number[] = []
    for (let i = 0; i < form.length; i++) {
      if (form[i] === '4' && new Date(filingDate[i]).getTime() > cutoff) {
        form4Indices.push(i)
      }
    }

    if (form4Indices.length === 0) return { ...empty, summary: 'No Form 4 filings in the past 90 days.' }

    // Parse each Form 4 XML (limit to 10 most recent for performance)
    const transactions: InsiderTransaction[] = []

    for (const idx of form4Indices.slice(0, 10)) {
      const accession = accessionNumber[idx].replace(/-/g, '')
      const doc       = primaryDocument[idx]
      const xmlUrl    = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/` +
                        `${accession}/${doc}`

      try {
        const xmlResp = await fetch(xmlUrl, { headers: HEADERS, next: { revalidate: 3600 } })
        if (!xmlResp.ok) continue
        const xml = await xmlResp.text()

        // Extract key fields with simple regex (XML is well-structured in Form 4)
        const rptOwnerName   = xml.match(/<rptOwnerName>(.*?)<\/rptOwnerName>/)?.[1]?.trim() ?? 'Unknown'
        const officerTitle   = xml.match(/<officerTitle>(.*?)<\/officerTitle>/)?.[1]?.trim() ?? ''

        // Non-derivative transactions
        const txBlocks = xml.match(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g) ?? []

        for (const block of txBlocks) {
          const code  = block.match(/<transactionCode>(.*?)<\/transactionCode>/)?.[1]?.trim() ?? ''
          const sharesRaw = block.match(/<transactionShares>\s*<value>([\d.]+)<\/value>/)?.[1]
          const priceRaw  = block.match(/<transactionPricePerShare>\s*<value>([\d.]+)<\/value>/)?.[1]
          const ownedRaw  = block.match(/<sharesOwnedFollowingTransaction>\s*<value>([\d.]+)<\/value>/)?.[1]

          const shares = sharesRaw ? parseFloat(sharesRaw) : 0
          const price  = priceRaw  ? parseFloat(priceRaw)  : null

          if (!code || shares === 0) continue

          transactions.push({
            filedAt:         filingDate[idx],
            insiderName:     rptOwnerName,
            insiderTitle:    officerTitle,
            transactionType: parseTransactionCode(code),
            shares,
            pricePerShare:   price,
            totalValue:      price ? price * shares : null,
            sharesOwned:     ownedRaw ? parseFloat(ownedRaw) : null,
            formUrl:         `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${doc}`,
          })
        }
      } catch {
        // Individual filing parse failure — continue
      }
    }

    // Sort newest first
    transactions.sort((a, b) => b.filedAt.localeCompare(a.filedAt))

    const signal  = buildSignal(transactions)
    const summary = buildSummaryText(transactions, signal)

    return { ticker, transactions, netBuySignal: signal, summary }
  } catch (err) {
    console.error('[EDGAR] getInsiderTransactions error:', err)
    return empty
  }
}
