'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Database } from '@/lib/types/database'
import type { Position } from '@/lib/types/database'

type PositionRow = Database['public']['Tables']['positions']['Row']

// Converts a Supabase DB row to the app-level Position shape
function rowToPosition(row: PositionRow): Position {
  const fs = (row.factor_scores ?? {}) as { q?: number; g?: number; v?: number; m?: number; s?: number }
  return {
    id:           row.id,
    ticker:       row.ticker,
    name:         row.name,
    exchange:     row.exchange,
    sector:       row.sector,
    subIndustry:  row.sub_industry ?? '',
    shares:       row.shares,
    avgBuyPrice:  row.avg_buy_price,
    currentPrice: row.current_price,
    currency:     row.currency,
    factorScores: { q: fs.q ?? 0, g: fs.g ?? 0, v: fs.v ?? 0, m: fs.m ?? 0, s: fs.s ?? 0 },
    conviction:   row.conviction,
    thesis:       row.thesis  ?? '',
    notes:        row.notes   ?? '',
    addedDate:    row.added_at,
  }
}

const PRICE_REFRESH_INTERVAL = 60_000   // 1 minute

export function usePortfolioData() {
  const positions    = useDashboardStore((s) => s.positions)
  const setPositions = useDashboardStore((s) => s.setPositions)
  const setPrices    = useDashboardStore((s) => s.setPrices)
  const setLoading   = useDashboardStore((s) => s.setLoading)
  const setSyncing   = useDashboardStore((s) => s.setSyncing)
  const pricesLastFetched = useDashboardStore((s) => s.pricesLastFetched)
  const addAlert     = useDashboardStore((s) => s.addAlert)

  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load positions from Supabase ────────────────────────────────────────────
  const loadPositions = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/positions')
      if (!resp.ok) throw new Error('Failed to load positions')
      const { data } = await resp.json() as { data: PositionRow[] }
      setPositions(data.map(rowToPosition))
    } catch (err) {
      console.error('[usePortfolioData] loadPositions:', err)
    } finally {
      setLoading(false)
    }
  }, [setLoading, setPositions])

  // ── Refresh live prices — fetch Stooq directly from browser ─────────────────
  // Stooq blocks server-side requests (Next.js API route IPs are blacklisted).
  // The HTML reference fetches Stooq from the browser; we replicate that here.
  const refreshPrices = useCallback(async (pos: Position[]) => {
    if (pos.length === 0) return
    setSyncing(true)
    try {
      const prices:     Record<string, number> = {}
      const prevPrices: Record<string, number> = {}

      // Exchange suffix map — mirrors stooq.ts
      const SUFFIX: Record<string, string> = {
        NYSE: '', NASDAQ: '', AMEX: '',
        LSE: '.UK', AMS: '.NL', EURONEXT: '.NL',
        XETRA: '.DE', EPA: '.FR', TSX: '.CA', ASX: '.AU',
      }
      // symbol → ticker reverse map
      const symToTicker: Record<string, string> = {}
      const symbols = pos.map((p) => {
        const suffix = SUFFIX[p.exchange?.toUpperCase() ?? ''] ?? ''
        const sym = `${p.ticker.toLowerCase()}${suffix}`
        symToTicker[sym] = p.ticker
        return sym
      })

      const url = `https://stooq.com/q/l/?f=sd2t2ohlcvp&h&e=csv&s=${symbols.join(',')}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`Stooq HTTP ${resp.status}`)

      const csv   = await resp.text()
      const lines = csv.trim().split('\n')

      // Skip header (line 0), parse data rows
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].trim().split(',')
        if (cols.length < 7) continue
        const sym    = cols[0].toLowerCase()
        const ticker = symToTicker[sym] ?? sym.toUpperCase()
        const close  = parseFloat(cols[6])
        const prev   = parseFloat(cols[8] ?? 'NaN')
        if (!isNaN(close) && close > 0) {
          prices[ticker]    = close
          if (!isNaN(prev) && prev > 0) prevPrices[ticker] = prev
        }
      }

      setPrices(prices, prevPrices)

      // Check for stop-loss threshold crossings
      const existingAlerts = useDashboardStore.getState().alerts
      for (const p of pos) {
        const livePrice = prices[p.ticker]
        if (livePrice == null || p.avgBuyPrice <= 0) continue
        if (livePrice < p.avgBuyPrice * 0.85) {
          const hasUnread = existingAlerts.some(
            (a) => !a.readAt && a.ticker === p.ticker && a.type === 'price'
          )
          if (!hasUnread) {
            addAlert({
              type: 'price',
              ticker: p.ticker,
              message: `${p.ticker} is down >15% from avg buy — review position`,
            })
          }
        }
      }
    } catch (err) {
      console.error('[usePortfolioData] refreshPrices:', err)
    } finally {
      setSyncing(false)
    }
  }, [setSyncing, setPrices, addAlert])

  // ── On mount: load positions then immediately fetch prices ──────────────────
  useEffect(() => {
    loadPositions()
  }, [loadPositions])

  // ── Once positions are loaded, start the price refresh loop ─────────────────
  useEffect(() => {
    if (positions.length === 0) return

    // Fetch immediately if stale (>1 min old) or never fetched
    const now = Date.now()
    const stale = !pricesLastFetched || (now - pricesLastFetched) > PRICE_REFRESH_INTERVAL
    if (stale) {
      refreshPrices(positions)
    }

    // Set up recurring refresh
    if (priceTimerRef.current) clearInterval(priceTimerRef.current)
    priceTimerRef.current = setInterval(() => {
      refreshPrices(positions)
    }, PRICE_REFRESH_INTERVAL)

    return () => {
      if (priceTimerRef.current) clearInterval(priceTimerRef.current)
    }
  }, [positions, pricesLastFetched, refreshPrices])

  return { loadPositions, refreshPrices }
}
