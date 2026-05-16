'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

type SourceStatus = 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR' | 'CHECKING'

interface DataSource {
  id:          string
  name:        string
  description: string
  status:      SourceStatus
  lastChecked: string | null
  via?:        string
}

const INITIAL_SOURCES: DataSource[] = [
  {
    id:          'stooq',
    name:        'Stooq',
    description: 'End-of-day and intraday price data for stocks and ETFs',
    status:      'CHECKING',
    lastChecked: null,
  },
  {
    id:          'railway',
    name:        'Railway Backend',
    description: 'Scoring engine, signal generation, and enrichment pipeline',
    status:      'CHECKING',
    lastChecked: null,
  },
  {
    id:          'supabase',
    name:        'Supabase',
    description: 'Portfolio persistence, watchlist, and user data',
    status:      'CONNECTED',
    lastChecked: new Date().toISOString(),
  },
  {
    id:          'polymarket',
    name:        'Polymarket',
    description: 'Prediction market sentiment signals for positions',
    status:      'CHECKING',
    lastChecked: null,
    via:         'Railway',
  },
  {
    id:          'sec',
    name:        'SEC / Insider Data',
    description: 'Insider transactions and SEC filings',
    status:      'CHECKING',
    lastChecked: null,
    via:         'Railway',
  },
]

export default function SourcesView() {
  const [sources,    setSources]    = useState<DataSource[]>(INITIAL_SOURCES)
  const [refreshing, setRefreshing] = useState(false)

  const checkAll = useCallback(async () => {
    setRefreshing(true)

    // Mark non-Supabase sources as checking
    setSources((prev) =>
      prev.map((s) => s.id === 'supabase' ? s : { ...s, status: 'CHECKING' })
    )

    const now = new Date().toISOString()

    // Check Stooq
    const stooqPromise = fetch('/api/prices?tickers=AAPL.US')
      .then((r) => (r.ok ? 'CONNECTED' : 'ERROR') as SourceStatus)
      .catch(() => 'ERROR' as SourceStatus)

    // Check Railway (and derive Polymarket/SEC from it)
    const railwayPromise = fetch('/api/railway/health')
      .then((r) => {
        if (r.status === 404 || r.status === 503) return 'NOT CONFIGURED' as SourceStatus
        return r.ok ? 'CONNECTED' : 'ERROR' as SourceStatus
      })
      .catch(() => 'ERROR' as SourceStatus)

    const [stooqStatus, railwayStatus] = await Promise.all([stooqPromise, railwayPromise])

    setSources((prev) =>
      prev.map((s) => {
        if (s.id === 'supabase') return s
        if (s.id === 'stooq')    return { ...s, status: stooqStatus,   lastChecked: now }
        if (s.id === 'railway')  return { ...s, status: railwayStatus, lastChecked: now }
        // Polymarket and SEC depend on Railway
        if (s.via === 'Railway') return { ...s, status: railwayStatus, lastChecked: now }
        return s
      })
    )

    setRefreshing(false)
  }, [])

  // Run initial check on first render
  // eslint-disable-next-line react/display-name
  useState(() => { checkAll() })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Data Sources</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Quality and freshness of your data connections</p>
        </div>
        <button
          onClick={checkAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      {/* Source grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: DataSource }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{source.name}</h3>
            {source.via && (
              <span className="text-xs text-zinc-600">via {source.via}</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{source.description}</p>
        </div>
        <StatusPill status={source.status} />
      </div>
      {source.lastChecked && (
        <p className="text-xs text-zinc-600">
          Last checked: {new Date(source.lastChecked).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: SourceStatus }) {
  if (status === 'CHECKING') {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse" />
        Checking
      </span>
    )
  }

  const map: Record<Exclude<SourceStatus, 'CHECKING'>, { dot: string; text: string; bg: string }> = {
    'CONNECTED':      { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-900/30' },
    'NOT CONFIGURED': { dot: 'bg-zinc-500',    text: 'text-zinc-400',    bg: 'bg-zinc-800'       },
    'ERROR':          { dot: 'bg-red-400',      text: 'text-red-300',     bg: 'bg-red-900/30'     },
  }

  const { dot, text, bg } = map[status]

  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}
