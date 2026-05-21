'use client'

import { useState } from 'react'
import { usePositions, useRailwayUrl } from '@/lib/store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CatalystState {
  loading: boolean
  error: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BackendBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
      <span className="text-base shrink-0 mt-0.5" style={{ color: 'var(--warning-text)' }}>⚠</span>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>Railway backend not connected</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--warning-text)', opacity: 0.8 }}>
          Configure <span className="font-mono">RAILWAY_BACKEND_URL</span> in your environment and
          set the Railway URL in{' '}
          <span className="font-medium">Settings</span> to fetch live catalyst data.
        </p>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CatalystResults({ data }: { data: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.catalysts) ? data.catalysts : Array.isArray(data?.data) ? data.data : []

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-700 py-6 text-center">
        <p className="text-xs text-zinc-500">No catalysts returned from backend.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 mt-2">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((item: any, i: number) => {
        const eventType   = item.event_type   ?? item.type        ?? item.category ?? 'Event'
        const date        = item.date          ?? item.event_date  ?? item.scheduled_at ?? null
        const description = item.description   ?? item.title       ?? item.summary     ?? null
        const ticker      = item.ticker        ?? item.symbol      ?? null
        const importance  = item.importance    ?? item.priority    ?? item.impact      ?? null

        return (
          <div key={i} className="surface px-3 py-3 flex items-start gap-3" style={{ borderRadius: 8 }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {ticker && (
                  <span className="pill pill-info font-mono font-semibold">
                    {ticker}
                  </span>
                )}
                <span className="pill pill-neutral">
                  {eventType}
                </span>
                {importance && (
                  <span className={`pill ${
                    String(importance).toLowerCase() === 'high' ? 'pill-danger' :
                    String(importance).toLowerCase() === 'medium' ? 'pill-warning' :
                    'pill-neutral'
                  }`}>
                    {importance}
                  </span>
                )}
                {date && (
                  <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CatalystCard({ ticker }: { ticker: string }) {
  const [state, setState] = useState<CatalystState>({
    loading: false,
    error: null,
    data: null,
  })

  async function fetchCatalysts() {
    setState({ loading: true, error: null, data: null })
    try {
      const resp = await fetch(`/api/railway/catalysts?tickers=${encodeURIComponent(ticker)}`)
      const json = await resp.json()
      if (!resp.ok) {
        setState({ loading: false, error: json.error ?? `HTTP ${resp.status}`, data: null })
      } else {
        setState({ loading: false, error: null, data: json })
      }
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
        data: null,
      })
    }
  }

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Upcoming catalysts for{' '}
            <span className="font-mono" style={{ color: 'var(--primary)' }}>{ticker}</span>
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Earnings, FDA events, product launches, macro triggers
          </p>
        </div>
        <button
          onClick={fetchCatalysts}
          disabled={state.loading}
          className="btn flex items-center gap-1.5 disabled:opacity-50"
        >
          {state.loading ? (
            <>
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Fetching…
            </>
          ) : (
            <>
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="6" />
              </svg>
              Fetch
            </>
          )}
        </button>
      </div>

      {/* States */}
      {state.error && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)', color: 'var(--danger-text)' }}>
          {state.error}
        </div>
      )}

      {state.data && !state.error && (
        <CatalystResults data={state.data} />
      )}

      {!state.loading && !state.data && !state.error && (
        <div className="rounded-lg py-6 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Click Fetch to load catalyst data from the Railway backend.
          </p>
        </div>
      )}
    </div>
  )
}

function MarketEventsSection() {
  return (
    <div className="rounded-xl px-5 py-5" style={{ border: '1px dashed var(--border)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Market Events</h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Connect Railway backend in Settings to see upcoming catalysts.
      </p>
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function CatalystView() {
  const positions   = usePositions()
  const railwayUrl  = useRailwayUrl()

  const backendConfigured = Boolean(railwayUrl)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◇ Catalyst Calendar</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.85 }}>Track upcoming events that may move your positions</div>
      </div>

      {/* Backend banner */}
      {!backendConfigured && <BackendBanner />}

      {/* Position catalyst cards */}
      {positions.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No positions in your portfolio yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((pos) => (
            <CatalystCard key={pos.id} ticker={pos.ticker} />
          ))}
        </div>
      )}

      {/* Market events placeholder */}
      <MarketEventsSection />
    </div>
  )
}
