import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type {
  Position,
  WatchlistItem,
  PortfolioSettings,
  SoldPosition,
} from '@/lib/types/database'

// ============================================================
// Sub-state types
// ============================================================

export interface PriceMap {
  [ticker: string]: number
}

export interface PortfolioStats {
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPct: number
  dayChange: number
  dayChangePct: number
  cashBuffer: number
  cashPct: number
}

export interface Alert {
  id: string
  type: 'price' | 'score' | 'signal' | 'system'
  ticker?: string
  message: string
  createdAt: string
  readAt?: string
}

export interface SignalCache {
  [ticker: string]: {
    signals: Record<string, unknown>
    fetchedAt: number
    verdict?: {
      finalVerdict: string
      confidence: number
      reasoning?: string
    }
  }
}

// ============================================================
// Default settings — mirrors the HTML dashboard defaults
// ============================================================

const DEFAULT_SETTINGS: PortfolioSettings = {
  weights: {
    quality:   0.25,
    growth:    0.25,
    valuation: 0.20,
    momentum:  0.15,
    sentiment: 0.15,
  },
  caps: {
    singleName: 15,
    sector:     35,
    regionUS:   60,
    regionEU:   40,
    USD:        70,
    cash:       20,
  },
  currency: 'EUR',
}

// ============================================================
// Store shape
// ============================================================

interface DashboardState {
  // ── Auth ───────────────────────────────────────────────────
  userId: string | null

  // ── Core portfolio data ────────────────────────────────────
  positions:   Position[]
  watchlist:   WatchlistItem[]
  soldPositions: SoldPosition[]
  settings:    PortfolioSettings
  cash:        number

  // ── Live prices (in-memory only, not persisted) ────────────
  prices:      PriceMap
  pricesLastFetched: number | null

  // ── Signals cache (in-memory) ──────────────────────────────
  signalCache: SignalCache

  // ── Derived stats (computed, not persisted) ────────────────
  stats:       PortfolioStats | null

  // ── UI state ───────────────────────────────────────────────
  activeTab:   string
  alerts:      Alert[]
  isLoading:   boolean
  isSyncing:   boolean

  // ── Actions ────────────────────────────────────────────────
  setUserId:        (id: string | null) => void

  // Positions
  setPositions:     (positions: Position[]) => void
  upsertPosition:   (position: Position) => void
  removePosition:   (id: string) => void

  // Watchlist
  setWatchlist:     (watchlist: WatchlistItem[]) => void
  upsertWatchlistItem: (item: WatchlistItem) => void
  removeWatchlistItem: (id: string) => void

  // Sold positions
  setSoldPositions: (sold: SoldPosition[]) => void
  addSoldPosition:  (sold: SoldPosition) => void

  // Settings
  setSettings:      (settings: Partial<PortfolioSettings>) => void
  setCash:          (amount: number) => void

  // Prices
  setPrices:        (prices: PriceMap) => void
  updatePrice:      (ticker: string, price: number) => void

  // Signals
  setSignalCache:   (ticker: string, data: SignalCache[string]) => void
  clearSignalCache: (ticker?: string) => void

  // Stats
  computeStats:     () => void

  // UI
  setActiveTab:     (tab: string) => void
  addAlert:         (alert: Omit<Alert, 'id' | 'createdAt'>) => void
  markAlertRead:    (id: string) => void
  clearAlerts:      () => void
  setLoading:       (v: boolean) => void
  setSyncing:       (v: boolean) => void

  // Data hydration (called after Supabase fetch)
  hydrate: (data: {
    positions?:    Position[]
    watchlist?:    WatchlistItem[]
    soldPositions?: SoldPosition[]
    settings?:     PortfolioSettings
    cash?:         number
  }) => void

  // Reset everything (logout)
  reset: () => void
}

// ============================================================
// Helpers
// ============================================================

function computePortfolioStats(
  positions: Position[],
  prices:    PriceMap,
  cash:      number,
  currency:  string
): PortfolioStats {
  let totalValue = 0
  let totalCost  = 0

  for (const p of positions) {
    const price = prices[p.ticker] ?? p.currentPrice
    totalValue += price * p.shares
    totalCost  += p.avgBuyPrice * p.shares
  }

  const totalPnL    = totalValue - totalCost
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const totalWithCash = totalValue + cash
  const cashPct     = totalWithCash > 0 ? (cash / totalWithCash) * 100 : 0

  return {
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPct,
    dayChange:    0,   // requires yesterday's close — filled by price fetcher
    dayChangePct: 0,
    cashBuffer:   cash,
    cashPct,
  }
}

// ============================================================
// Store
// ============================================================

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ─────────────────────────────────────
        userId:         null,
        positions:      [],
        watchlist:      [],
        soldPositions:  [],
        settings:       DEFAULT_SETTINGS,
        cash:           0,
        prices:         {},
        pricesLastFetched: null,
        signalCache:    {},
        stats:          null,
        activeTab:      'portfolio',
        alerts:         [],
        isLoading:      false,
        isSyncing:      false,

        // ── Auth ──────────────────────────────────────────────
        setUserId: (id) => set({ userId: id }),

        // ── Positions ─────────────────────────────────────────
        setPositions: (positions) => {
          set({ positions })
          get().computeStats()
        },

        upsertPosition: (position) => {
          const positions = get().positions
          const idx = positions.findIndex((p) => p.id === position.id)
          const next = idx >= 0
            ? positions.map((p, i) => (i === idx ? position : p))
            : [...positions, position]
          set({ positions: next })
          get().computeStats()
        },

        removePosition: (id) => {
          set({ positions: get().positions.filter((p) => p.id !== id) })
          get().computeStats()
        },

        // ── Watchlist ─────────────────────────────────────────
        setWatchlist: (watchlist) => set({ watchlist }),

        upsertWatchlistItem: (item) => {
          const list = get().watchlist
          const idx  = list.findIndex((w) => w.id === item.id)
          const next = idx >= 0
            ? list.map((w, i) => (i === idx ? item : w))
            : [...list, item]
          set({ watchlist: next })
        },

        removeWatchlistItem: (id) => {
          set({ watchlist: get().watchlist.filter((w) => w.id !== id) })
        },

        // ── Sold positions ────────────────────────────────────
        setSoldPositions: (sold) => set({ soldPositions: sold }),
        addSoldPosition:  (sold) =>
          set({ soldPositions: [sold, ...get().soldPositions] }),

        // ── Settings ──────────────────────────────────────────
        setSettings: (partial) =>
          set((s) => ({
            settings: {
              ...s.settings,
              ...partial,
              weights: { ...s.settings.weights, ...(partial.weights ?? {}) },
              caps:    { ...s.settings.caps,    ...(partial.caps    ?? {}) },
            },
          })),

        setCash: (amount) => {
          set({ cash: amount })
          get().computeStats()
        },

        // ── Prices ────────────────────────────────────────────
        setPrices: (prices) => {
          set({ prices, pricesLastFetched: Date.now() })
          get().computeStats()
        },

        updatePrice: (ticker, price) => {
          set((s) => ({ prices: { ...s.prices, [ticker]: price } }))
          get().computeStats()
        },

        // ── Signals ───────────────────────────────────────────
        setSignalCache: (ticker, data) =>
          set((s) => ({ signalCache: { ...s.signalCache, [ticker]: data } })),

        clearSignalCache: (ticker) => {
          if (ticker) {
            set((s) => {
              const next = { ...s.signalCache }
              delete next[ticker]
              return { signalCache: next }
            })
          } else {
            set({ signalCache: {} })
          }
        },

        // ── Stats ─────────────────────────────────────────────
        computeStats: () => {
          const { positions, prices, cash, settings } = get()
          set({ stats: computePortfolioStats(positions, prices, cash, settings.currency) })
        },

        // ── UI ────────────────────────────────────────────────
        setActiveTab: (tab) => set({ activeTab: tab }),

        addAlert: (alert) => {
          const id = crypto.randomUUID()
          set((s) => ({
            alerts: [
              { ...alert, id, createdAt: new Date().toISOString() },
              ...s.alerts,
            ].slice(0, 100),   // keep last 100
          }))
        },

        markAlertRead: (id) =>
          set((s) => ({
            alerts: s.alerts.map((a) =>
              a.id === id ? { ...a, readAt: new Date().toISOString() } : a
            ),
          })),

        clearAlerts: () => set({ alerts: [] }),

        setLoading:  (v) => set({ isLoading: v }),
        setSyncing:  (v) => set({ isSyncing: v }),

        // ── Hydrate ───────────────────────────────────────────
        hydrate: ({ positions, watchlist, soldPositions, settings, cash }) => {
          set((s) => ({
            positions:     positions    ?? s.positions,
            watchlist:     watchlist    ?? s.watchlist,
            soldPositions: soldPositions ?? s.soldPositions,
            settings:      settings     ?? s.settings,
            cash:          cash         ?? s.cash,
          }))
          get().computeStats()
        },

        // ── Reset ─────────────────────────────────────────────
        reset: () =>
          set({
            userId:            null,
            positions:         [],
            watchlist:         [],
            soldPositions:     [],
            settings:          DEFAULT_SETTINGS,
            cash:              0,
            prices:            {},
            pricesLastFetched: null,
            signalCache:       {},
            stats:             null,
            activeTab:         'portfolio',
            alerts:            [],
            isLoading:         false,
            isSyncing:         false,
          }),
      }),
      {
        name: 'p3-dashboard',
        // Persist user preferences and portfolio data,
        // but NOT prices (stale) or signal cache (too large)
        partialize: (state) => ({
          userId:        state.userId,
          positions:     state.positions,
          watchlist:     state.watchlist,
          soldPositions: state.soldPositions,
          settings:      state.settings,
          cash:          state.cash,
          activeTab:     state.activeTab,
          alerts:        state.alerts,
        }),
      }
    ),
    { name: 'P3Dashboard' }
  )
)

// ── Selector hooks (avoid full re-renders) ─────────────────────

export const usePositions     = () => useDashboardStore((s) => s.positions)
export const useWatchlist     = () => useDashboardStore((s) => s.watchlist)
export const useSoldPositions = () => useDashboardStore((s) => s.soldPositions)
export const useSettings      = () => useDashboardStore((s) => s.settings)
export const useCash          = () => useDashboardStore((s) => s.cash)
export const usePrices        = () => useDashboardStore((s) => s.prices)
export const useStats         = () => useDashboardStore((s) => s.stats)
export const useAlerts        = () => useDashboardStore((s) => s.alerts)
export const useActiveTab     = () => useDashboardStore((s) => s.activeTab)
export const useIsLoading     = () => useDashboardStore((s) => s.isLoading)
export const useIsSyncing     = () => useDashboardStore((s) => s.isSyncing)
export const useSignalCache   = (ticker: string) =>
  useDashboardStore((s) => s.signalCache[ticker])
