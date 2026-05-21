'use client'

import { useState } from 'react'
import { usePositions, usePrices, useStats, useRailwayUrl } from '@/lib/store'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Types ──────────────────────────────────────────────────────────────────────

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { status: 'success'; data: any }

// ── Sub-components ─────────────────────────────────────────────────────────────

function BackendBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
      <span className="text-base shrink-0 mt-0.5" style={{ color: 'var(--warning-text)' }}>⚠</span>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>Railway backend not connected</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--warning-text)', opacity: 0.8 }}>
          Configure <span className="font-mono">RAILWAY_BACKEND_URL</span> in your environment
          and set the Railway URL in{' '}
          <span className="font-medium">Settings</span> to enable AI hedge
          suggestions.
        </p>
      </div>
    </div>
  )
}

interface HedgeCardProps {
  title: string
  description: string
  examples: string[]
  icon: string
}

function HedgeCard({ title, description, examples, icon }: HedgeCardProps) {
  return (
    <div className="surface p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {examples.map((ex) => (
              <span key={ex} className="pill pill-neutral font-mono">
                {ex}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AiHedgeResults({ data }: { data: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.suggestions) ? data.suggestions : Array.isArray(data?.data) ? data.data : []

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-lg py-6 text-center" style={{ border: '1px dashed var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No hedge suggestions returned from backend.</p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>AI hedge suggestions:</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((item: any, i: number) => {
        const instrument = item.instrument ?? item.ticker   ?? item.symbol ?? item.name ?? `Suggestion ${i + 1}`
        const rationale  = item.rationale  ?? item.reason  ?? item.description ?? null
        const weight     = item.weight     ?? item.weight_pct ?? item.allocation ?? null

        return (
          <div key={i} className="surface px-3 py-3 flex items-start gap-3" style={{ borderRadius: 8 }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{instrument}</span>
                {weight != null && (
                  <span className="pill pill-info ml-auto font-mono">
                    {typeof weight === 'number' ? `${weight}%` : weight}
                  </span>
                )}
              </div>
              {rationale && (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{rationale}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function HedgeView() {
  const positions  = usePositions()
  const prices     = usePrices()
  const stats      = useStats()
  const railwayUrl = useRailwayUrl()

  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })

  const backendConfigured = Boolean(railwayUrl)
  const totalValue = stats?.totalValue ?? 0

  // Derive largest sector
  const sectorCounts = positions.reduce<Record<string, number>>((acc, pos) => {
    if (pos.sector) acc[pos.sector] = (acc[pos.sector] ?? 0) + 1
    return acc
  }, {})
  const largestSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Rough USD exposure: count positions where currency is USD
  const usdPositions = positions.filter((p) => p.currency === 'USD')
  const usdValue = usdPositions.reduce((sum, pos) => {
    const price = prices[pos.ticker] ?? pos.currentPrice
    return sum + price * pos.shares
  }, 0)
  const usdExposurePct = totalValue > 0 ? (usdValue / totalValue) * 100 : 0

  const tickers = positions.map((p) => p.ticker)

  async function getHedgeSuggestions() {
    setFetchState({ status: 'loading' })
    try {
      const resp = await fetch('/api/railway/hedge/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setFetchState({ status: 'error', message: json.error ?? `HTTP ${resp.status}` })
      } else {
        setFetchState({ status: 'success', data: json })
      }
    } catch (err) {
      setFetchState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    }
  }

  const hedgeCards: HedgeCardProps[] = [
    {
      title: 'Inverse ETFs',
      description:
        'Short broad-market or sector-specific ETFs to profit when your long positions fall. Typically used as tactical hedges for short time horizons.',
      examples: ['SH', 'PSQ', 'SQQQ', 'DOG', 'SDS'],
      icon: '↕',
    },
    {
      title: 'Volatility (VIX)',
      description:
        'VIX-linked products typically spike during market stress. Holding a small VIX allocation can offset portfolio losses in a sharp drawdown.',
      examples: ['UVXY', 'VIXY', 'VXX', 'SVXY'],
      icon: '⚡',
    },
    {
      title: 'Defensive Rotation',
      description:
        'Rotate into low-beta, high-dividend sectors: Utilities, Consumer Staples, Healthcare. These tend to hold value when growth stocks sell off.',
      examples: ['XLU', 'XLP', 'XLV', 'VDC', 'IDU'],
      icon: '🛡',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--warning-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--warning-text)' }}>🛡 Hedge Suggestions</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--warning-text)', opacity: 0.85 }}>Protect your portfolio against macro risks and sharp drawdowns</div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--warning-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--warning-text)', lineHeight: 1.6 }}>
            Review portfolio hedging strategies and get AI-powered recommendations tailored to your factor exposures.
          </div>
        </div>
      </div>

      {/* Backend banner */}
      {!backendConfigured && <BackendBanner />}

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Value</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtCurrency(totalValue)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Largest Sector</div>
          <div className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{largestSector}</div>
        </div>
        <div className="kpi-card col-span-2 sm:col-span-1">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>USD Exposure</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {usdExposurePct.toFixed(1)}%
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fmtCurrency(usdValue)}</div>
        </div>
      </div>

      {/* Get suggestions button */}
      <div className="surface px-5 py-5">
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>AI Hedge Analysis</h3>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Send your current portfolio to the Railway backend for AI-powered hedge recommendations
          tailored to your factor exposures, sector concentrations, and macro environment.
        </p>

        <button
          onClick={getHedgeSuggestions}
          disabled={fetchState.status === 'loading' || positions.length === 0}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {fetchState.status === 'loading' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Fetching suggestions…
            </>
          ) : (
            'Get Hedge Suggestions'
          )}
        </button>

        {positions.length === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>Add positions to your portfolio first.</p>
        )}

        {/* Error state */}
        {fetchState.status === 'error' && (
          <div className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)', color: 'var(--danger-text)' }}>
            {fetchState.message}
          </div>
        )}

        {/* Success state */}
        {fetchState.status === 'success' && (
          <AiHedgeResults data={fetchState.data} />
        )}

        {/* Not configured state */}
        {!backendConfigured && fetchState.status === 'idle' && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Connect Railway to get AI hedge suggestions.
          </p>
        )}
      </div>

      {/* Placeholder hedge cards */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Common Hedging Strategies
        </h3>
        <div className="space-y-3">
          {hedgeCards.map((card) => (
            <HedgeCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      {/* Setup note */}
      {!backendConfigured && (
        <div className="rounded-xl px-5 py-4" style={{ border: '1px dashed var(--border)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>How to enable AI hedging</h3>
          <ol className="list-decimal list-inside space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <li>Deploy the Railway backend service</li>
            <li>
              Set <span className="font-mono" style={{ color: 'var(--text-primary)' }}>RAILWAY_BACKEND_URL</span> in your{' '}
              <span className="font-mono">.env.local</span>
            </li>
            <li>Enter the URL in the Settings tab</li>
            <li>Come back here and click "Get Hedge Suggestions"</li>
          </ol>
        </div>
      )}
    </div>
  )
}
