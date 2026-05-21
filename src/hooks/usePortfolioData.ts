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

const PRICE_REFRESH_INTERVAL = 30_000   // 30 seconds

export function usePortfolioData() {
  const positions    = useDashboardStore((s) => s.positions)
  const setPositions = useDashboardStore((s) => s.setPositions)
  const setPrices    = useDashboardStore((s) => s.setPrices)
  const setLoading   = useDashboardStore((s) => s.setLoading)
  const setSyncing   = useDashboardStore((s) => s.setSyncing)
  const addAlert     = useDashboardStore((s) => s.addAlert)

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  // Always-fresh ref — interval callback reads this instead of closing over stale state
  const positionsRef   = useRef<Position[]>(positions)
  positionsRef.current = positions

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

  // ── Refresh live prices via server-side proxy ───────────────────────────────
  const refreshPrices = useCallback(async (pos: Position[]) => {
    if (pos.length === 0) return
    setSyncing(true)
    try {
      const tickerParam = pos
        .map((p) => p.exchange ? `${p.ticker}:${p.exchange}` : p.ticker)
        .join(',')

      const resp = await fetch(`/api/prices?tickers=${encodeURIComponent(tickerParam)}`)
      if (!resp.ok) throw new Error(`/api/prices HTTP ${resp.status}`)

      const { prices, prevPrices } = await resp.json() as {
        prices:     Record<string, number>
        prevPrices: Record<string, number>
      }

      if (Object.keys(prices).length > 0) {
        setPrices(prices, prevPrices ?? {})
      }

      // Stop-loss alerts
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

  // ── Load positions on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadPositions()
  }, [loadPositions])

  // ── Start price polling once positions are available ────────────────────────
  // Uses a ref for positions so the interval never closes over stale data and
  // never needs to be recreated when positions/pricesLastFetched change.
  useEffect(() => {
    if (positions.length === 0) return

    // Fetch immediately on first mount
    refreshPrices(positionsRef.current)

    // Clear any stale interval before starting a new one
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      refreshPrices(positionsRef.current)
    }, PRICE_REFRESH_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  // Intentionally only depends on positions.length — we don't want the interval
  // to restart every time pricesLastFetched changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length, refreshPrices])

  return { loadPositions, refreshPrices }
}
