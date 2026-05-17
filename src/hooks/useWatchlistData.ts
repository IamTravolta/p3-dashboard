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
  const addAlert     = useDashboardStore((s) => s.addAlert)
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
      const { prices, prevPrices } = await resp.json() as { prices: Record<string, number>; prevPrices?: Record<string, number> }
      setPrices(prices, prevPrices)

      // Check for price and score trigger crossings
      const existingAlerts = useDashboardStore.getState().alerts
      for (const item of items) {
        const livePrice = prices[item.ticker]

        // Price trigger
        if (item.priceTrigger != null && livePrice != null && livePrice <= item.priceTrigger) {
          const hasUnread = existingAlerts.some(
            (a) => !a.readAt && a.ticker === item.ticker && a.type === 'price'
          )
          if (!hasUnread) {
            addAlert({
              type: 'price',
              ticker: item.ticker,
              message: `${item.ticker} hit price trigger €${item.priceTrigger} — entry window open`,
            })
          }
        }

        // Score trigger
        if (item.scoreTrigger != null && item.score >= item.scoreTrigger) {
          const hasUnread = existingAlerts.some(
            (a) => !a.readAt && a.ticker === item.ticker && a.type === 'score'
          )
          if (!hasUnread) {
            addAlert({
              type: 'score',
              ticker: item.ticker,
              message: `${item.ticker} score ${item.score} reached trigger ${item.scoreTrigger}`,
            })
          }
        }
      }
    } catch (err) {
      console.error('[useWatchlistData] prices:', err)
    } finally {
      setSyncing(false)
    }
  }, [setSyncing, setPrices, addAlert])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  // Keep a ref to the latest watchlist so the interval always uses fresh data
  const watchlistRef = useRef(watchlist)
  useEffect(() => { watchlistRef.current = watchlist }, [watchlist])

  useEffect(() => {
    if (watchlist.length === 0) return
    refreshPrices(watchlist)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(
      () => refreshPrices(watchlistRef.current),
      PRICE_REFRESH_INTERVAL,
    )
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [watchlist.length, refreshPrices]) // eslint-disable-line react-hooks/exhaustive-deps

  return { loadWatchlist, refreshPrices }
}
