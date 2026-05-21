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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>🔌 Data Sources</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.85 }}>Quality and freshness of your data connections</div>
          </div>
          <button
            onClick={checkAll}
            disabled={refreshing}
            className="btn flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh Status
          </button>
        </div>
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
    <div className="surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{source.name}</h3>
            {source.via && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>via {source.via}</span>
            )}
          </div>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{source.description}</p>
        </div>
        <StatusPill status={source.status} />
      </div>
      {source.lastChecked && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Last checked: {new Date(source.lastChecked).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: SourceStatus }) {
  if (status === 'CHECKING') {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--text-tertiary)' }} />
        Checking
      </span>
    )
  }

  const styleMap: Record<Exclude<SourceStatus, 'CHECKING'>, { dot: string; style: React.CSSProperties }> = {
    'CONNECTED':      { dot: 'var(--success-text)', style: { background: 'var(--success-bg)', color: 'var(--success-text)' } },
    'NOT CONFIGURED': { dot: 'var(--text-tertiary)', style: { background: 'var(--surface)', color: 'var(--text-secondary)' } },
    'ERROR':          { dot: 'var(--danger-text)',  style: { background: 'var(--danger-bg)', color: 'var(--danger-text)' } },
  }

  const { dot, style } = styleMap[status]

  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={style}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {status}
    </span>
  )
}
