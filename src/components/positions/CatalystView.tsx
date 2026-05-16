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
    <div className="flex items-start gap-3 rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3">
      <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
      <div>
        <p className="text-sm font-medium text-amber-300">Railway backend not connected</p>
        <p className="text-xs text-amber-500 mt-0.5">
          Configure <span className="font-mono">RAILWAY_BACKEND_URL</span> in your environment and
          set the Railway URL in{' '}
          <span className="font-medium text-amber-400">Settings</span> to fetch live catalyst data.
        </p>
      </div>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Upcoming catalysts for{' '}
            <span className="font-mono text-indigo-400">{ticker}</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Earnings, FDA events, product launches, macro triggers
          </p>
        </div>
        <button
          onClick={fetchCatalysts}
          disabled={state.loading}
          className="flex items-center gap-1.5 rounded-md bg-indigo-900/50 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-800 transition disabled:opacity-50"
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
        <div className="rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
          {state.error}
        </div>
      )}

      {state.data && !state.error && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3">
          <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(state.data, null, 2)}
          </pre>
        </div>
      )}

      {!state.loading && !state.data && !state.error && (
        <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center">
          <p className="text-xs text-zinc-600">
            Click Fetch to load catalyst data from the Railway backend.
          </p>
        </div>
      )}
    </div>
  )
}

function MarketEventsSection() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="text-2xl">🗓</div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Market Events</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Fed meetings, CPI releases, options expiry, and other macro events that may
            affect your portfolio will appear here once the Railway backend is connected.
          </p>
          <div className="mt-3 space-y-1.5">
            {['FOMC Meeting', 'CPI Release', 'Options Expiry', 'NFP Report'].map((event) => (
              <div
                key={event}
                className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2"
              >
                <span className="text-xs text-zinc-400">{event}</span>
                <span className="text-xs font-mono text-zinc-600">—</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Connect Railway backend in Settings to enable live market event tracking.
          </p>
        </div>
      </div>
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
      <div>
        <h2 className="text-sm font-semibold text-white">Catalyst Calendar</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Track upcoming events that may move your positions.
        </p>
      </div>

      {/* Backend banner */}
      {!backendConfigured && <BackendBanner />}

      {/* Position catalyst cards */}
      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-12 text-center">
          <p className="text-zinc-500 text-sm">No positions in your portfolio yet.</p>
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
