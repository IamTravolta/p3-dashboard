'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Database, WatchlistItem } from '@/lib/types/database'

type WatchlistRow = Database['public']['Tables']['watchlist']['Row']

function rowToItem(row: WatchlistRow): WatchlistItem {
  const fs = (row.factor_scores ?? {}) as { q?: number; g?: number; v?: number; m?: number; s?: number }
  return {
    id:           row.id,
    ticker:       row.ticker,
    name:         row.name,
    exchange:     row.exchange,
    sector:       row.sector,
    subIndustry:  row.sub_industry   ?? '',
    currentPrice: row.current_price,
    score:        row.score,
    factorScores: { q: fs.q ?? 0, g: fs.g ?? 0, v: fs.v ?? 0, m: fs.m ?? 0, s: fs.s ?? 0 },
    reason:       row.reason         ?? '',
    priceTrigger: row.price_trigger  ?? null,
    scoreTrigger: row.score_trigger  ?? null,
    conviction:   row.conviction,
    expiryDate:   row.expiry_date    ?? null,
    addedDate:    row.added_at,
  }
}

const PRICE_REFRESH_INTERVAL = 90_000   // 1.5 minutes (watchlist is less urgent)

export function useWatchlistData() {
  const watchlist    = useDashboardStore((s) => s.watchlist)
  const setWatchlist = useDashboardStore((s) => s.setWatchlist)
  const setPrices    = useDashboardStore((s) => s.setPrices)
  const setSyncing   = useDashboardStore((s) => s.setSyncing)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadWatchlist = useCallback(async () => {
    try {
      const resp = await fetch('/api/watchlist')
      if (!resp.ok) return
      const { data } = await resp.json() as { data: WatchlistRow[] }
      setWatchlist(data.map(rowToItem))
    } catch (err) {
      console.error('[useWatchlistData] load:', err)
    }
  }, [setWatchlist])

  const refreshPrices = useCallback(async (items: WatchlistItem[]) => {
    if (items.length === 0) return
    setSyncing(true)
    try {
      const param = items.map((w) => `${w.ticker}:${w.exchange}`).join(',')
      const resp  = await fetch(`/api/prices?tickers=${encodeURIComponent(param)}`)
      if (!resp.ok) return
      const { prices } = await resp.json() as { prices: Record<string, number> }
      setPrices(prices)
    } catch (err) {
      console.error('[useWatchlistData] prices:', err)
    } finally {
      setSyncing(false)
    }
  }, [setSyncing, setPrices])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  useEffect(() => {
    if (watchlist.length === 0) return
    refreshPrices(watchlist)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => refreshPrices(watchlist), PRICE_REFRESH_INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [watchlist.length, refreshPrices]) // eslint-disable-line react-hooks/exhaustive-deps

  return { loadWatchlist, refreshPrices }
}
