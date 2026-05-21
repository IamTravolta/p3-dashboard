'use client'
import { railwayFetch } from '@/lib/utils/railwayFetch'

import { useState } from 'react'
import { usePositions, usePrices, useStats, useSettings, useCash, useRailwayUrl } from '@/lib/store'
import type { Position } from '@/lib/types/database'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

type SizingStatus = 'OVERSIZED' | 'OPTIMAL' | 'UNDERSIZED'

function getStatus(current: number, maxCap: number): SizingStatus {
  if (current > maxCap) return 'OVERSIZED'
  if (current < maxCap * 0.4) return 'UNDERSIZED'
  return 'OPTIMAL'
}

function statusPill(status: SizingStatus) {
  const cls: Record<SizingStatus, string> = {
    OVERSIZED:  'pill pill-danger',
    OPTIMAL:    'pill pill-success',
    UNDERSIZED: 'pill pill-yellow',
  }
  return <span className={cls[status]}>{status}</span>
}

function suggestedAction(status: SizingStatus, current: number, maxCap: number): string {
  if (status === 'OVERSIZED') {
    const excess = current - maxCap
    return `Trim ~${fmt(excess, 1)}% to reach cap`
  }
  if (status === 'UNDERSIZED') {
    const room = maxCap * 0.7 - current
    return room > 0 ? `Room to add ~${fmt(room, 1)}%` : 'Consider adding'
  }
  return 'Hold — within optimal range'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KellyResults({ data }: { data: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendations: any[] = Array.isArray(data) ? data : Array.isArray(data?.recommendations) ? data.recommendations : Array.isArray(data?.data) ? data.data : []

  const summary = !Array.isArray(data) ? data : null

  return (
    <div className="mt-4 space-y-3">
      {/* Top-level summary fields if present */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {summary.recommended_size != null && (
            <div className="kpi-card">
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Recommended size</div>
              <div className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{summary.recommended_size}</div>
            </div>
          )}
          {summary.kelly_fraction != null && (
            <div className="kpi-card">
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Kelly fraction</div>
              <div className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{summary.kelly_fraction}</div>
            </div>
          )}
          {summary.max_allocation != null && (
            <div className="kpi-card">
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Max allocation</div>
              <div className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{summary.max_allocation}</div>
            </div>
          )}
        </div>
      )}

      {/* Per-ticker recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-400">Per-position sizing:</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {recommendations.map((item: any, i: number) => {
            const ticker     = item.ticker ?? item.symbol ?? `Position ${i + 1}`
            const recSize    = item.recommended_size ?? item.size         ?? null
            const kellyFrac  = item.kelly_fraction   ?? item.kelly        ?? null
            const maxAlloc   = item.max_allocation   ?? item.max          ?? null

            return (
              <div key={i} className="surface px-3 py-2 flex items-center gap-3" style={{ borderRadius: 8 }}>
                <span className="font-mono text-sm font-bold w-16 shrink-0" style={{ color: 'var(--text-primary)' }}>{ticker}</span>
                <div className="flex gap-4 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {recSize   != null && <span>Size: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{recSize}</span></span>}
                  {kellyFrac != null && <span>Kelly: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{kellyFrac}</span></span>}
                  {maxAlloc  != null && <span>Max: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{maxAlloc}</span></span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {recommendations.length === 0 && !summary && (
        <div className="rounded-lg py-4 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No sizing data returned from backend.</p>
        </div>
      )}
    </div>
  )
}

function SizingRow({
  position,
  currentWeight,
  maxCap,
}: {
  position: Position
  currentWeight: number
  maxCap: number
}) {
  const status = getStatus(currentWeight, maxCap)

  const barColor = status === 'OVERSIZED' ? 'var(--danger-text)' : status === 'OPTIMAL' ? 'var(--success-text)' : 'var(--yellow-text)'
  return (
    <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
      <td className="px-4 py-3">
        <div className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{position.ticker}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{position.name}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(currentWeight, 1)}%</div>
        <div className="mt-1 h-1 w-20 ml-auto rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min((currentWeight / maxCap) * 100, 100)}%`, background: barColor }}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(maxCap, 0)}%</span>
      </td>
      <td className="px-4 py-3 text-center">
        {statusPill(status)}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {suggestedAction(status, currentWeight, maxCap)}
      </td>
    </tr>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

type KellyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { status: 'success'; data: any }

export default function SizingView() {
  const positions  = usePositions()
  const prices     = usePrices()
  const stats      = useStats()
  const settings   = useSettings()
  const cash       = useCash()
  const railwayUrl = useRailwayUrl()

  const [kellyState, setKellyState] = useState<KellyState>({ status: 'idle' })

  const backendConfigured = Boolean(railwayUrl)

  const totalValue   = stats?.totalValue ?? 0
  const maxSinglePct = settings.caps.singleName // e.g. 15

  // Build enriched rows
  const rows = positions.map((pos) => {
    const livePrice = prices[pos.ticker] ?? pos.currentPrice
    const value  = livePrice * pos.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    return { position: pos, value, weight }
  })

  async function calculateKelly() {
    setKellyState({ status: 'loading' })
    try {
      const portfolioData = rows.map(({ position, value, weight }) => ({
        ticker:     position.ticker,
        weight,
        value,
        conviction: position.conviction,
      }))
      const resp = await railwayFetch('/api/railway/position-sizing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: portfolioData, totalValue }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setKellyState({ status: 'error', message: json.error ?? `HTTP ${resp.status}` })
      } else {
        setKellyState({ status: 'success', data: json })
      }
    } catch (err) {
      setKellyState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    }
  }

  const oversized  = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'OVERSIZED').length
  const undersized = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'UNDERSIZED').length
  const optimal    = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'OPTIMAL').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>⚖ Position Sizing (Kelly)</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>Kelly Criterion risk-adjusted allocation based on conviction</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>Per position: conviction (50% score + 35% smart money + 15% macro fit) × expected return / sector variance. Kelly formula with fractional multiplier.</div>
        </div>
      </div>

      {/* Settings panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Portfolio</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtCurrency(totalValue)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cash Available</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtCurrency(cash)}
          </div>
          {totalValue + cash > 0 && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {fmt(((cash) / (totalValue + cash)) * 100, 1)}% of total
            </div>
          )}
        </div>
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max Single Name</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{maxSinglePct}%</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>per settings</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max Sector</div>
          <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{settings.caps.sector}%</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>per settings</div>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--danger-text)' }} />
          <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{oversized} Oversized</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--success-bg)', border: '1px solid var(--success-text)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--success-text)' }} />
          <span className="text-xs" style={{ color: 'var(--success-text)' }}>{optimal} Optimal</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-text)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--yellow-text)' }} />
          <span className="text-xs" style={{ color: 'var(--yellow-text)' }}>{undersized} Undersized</span>
        </div>
      </div>

      {/* Table */}
      {positions.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No positions to size.</p>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Ticker
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Current Weight
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Max Cap
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Suggested Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.weight - a.weight)
                .map(({ position, weight }) => (
                  <SizingRow
                    key={position.id}
                    position={position}
                    currentWeight={weight}
                    maxCap={maxSinglePct}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kelly conviction-to-size reference table */}
      <div className="surface px-5 py-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Kelly Conviction → Positiegrootte</h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          Referentietabel: conviction-score bepaalt maximale positiegrootte via fractional Kelly. Hogere overtuiging = meer risicovermogen.
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Conviction', 'Label', 'Max size', 'Kelly fraction', 'Gebruik wanneer'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { conv: 1, label: 'Speculatief', size: '2%',  kelly: '0.20 f', when: 'Idee, weinig bewijs, eerste positie' },
                { conv: 2, label: 'Laag',        size: '3%',  kelly: '0.25 f', when: 'Redelijke basis, nog onzekerheid' },
                { conv: 3, label: 'Gemiddeld',   size: '5%',  kelly: '0.35 f', when: 'Solide thesis + 1-2 bevestigende signalen' },
                { conv: 4, label: 'Hoog',        size: '7%',  kelly: '0.50 f', when: 'Meerdere signalen groen + insider / smart money' },
                { conv: 5, label: 'Max',         size: '10%', kelly: '0.75 f', when: 'Hoogste overtuiging — zelden, max 1–2 posities' },
              ].map((row) => (
                <tr key={row.conv} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td className="px-3 py-2.5 text-center">
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                      style={{
                        background: row.conv >= 4 ? 'var(--success-bg)' : row.conv === 3 ? 'var(--info-bg)' : 'var(--surface)',
                        color: row.conv >= 4 ? 'var(--success-text)' : row.conv === 3 ? 'var(--info-text)' : 'var(--text-secondary)',
                        border: '0.5px solid var(--border)',
                      }}
                    >{row.conv}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</td>
                  <td className="px-3 py-2.5 text-xs font-mono font-bold"
                    style={{ color: row.conv >= 4 ? 'var(--success-text)' : row.conv === 3 ? 'var(--info-text)' : 'var(--text-secondary)' }}>
                    {row.size}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{row.kelly}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Capacity gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Conv 5 (max 1)', count: positions.filter(p => p.conviction >= 5).length, max: 2 },
            { label: 'Conv 4+ (≤4)', count: positions.filter(p => p.conviction >= 4).length, max: 4 },
            { label: 'Conv 3+ (core)', count: positions.filter(p => p.conviction >= 3).length, max: 10 },
            { label: 'Conv 1–2 (spec)', count: positions.filter(p => p.conviction <= 2).length, max: 5 },
          ].map((g) => {
            const pct = Math.min((g.count / g.max) * 100, 100)
            const color = pct >= 100 ? 'var(--danger-text)' : pct >= 75 ? 'var(--warning-text)' : 'var(--success-text)'
            return (
              <div key={g.label} className="kpi-card">
                <div className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>{g.label}</div>
                <div className="text-lg font-bold" style={{ color }}>{g.count}<span className="text-xs font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>/ {g.max}</span></div>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Kelly Criterion */}
      <div className="surface px-5 py-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Kelly AI Sizing (Railway)</h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          AI-powered optimal position sizing based on your historical win rates, conviction
          scores, and correlation matrix. Uses the Kelly formula adjusted for your risk tolerance.
        </p>

        {!backendConfigured ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Connect Railway backend in Settings to enable Kelly sizing.
          </p>
        ) : (
          <>
            <button
              onClick={calculateKelly}
              disabled={kellyState.status === 'loading' || positions.length === 0}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {kellyState.status === 'loading' ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Calculating…
                </>
              ) : (
                'Calculate Kelly Sizing'
              )}
            </button>

            {positions.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>Add positions to your portfolio first.</p>
            )}

            {kellyState.status === 'error' && (
              <div className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)', color: 'var(--danger-text)' }}>
                {kellyState.message}
              </div>
            )}

            {kellyState.status === 'success' && (
              <KellyResults data={kellyState.data} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
