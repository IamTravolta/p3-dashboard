'use client'

import { useState, useMemo } from 'react'
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

// ── Pre-trade checklist ────────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { id: 'thesis',      label: 'Thesis is duidelijk geformuleerd (groei, value, event)' },
  { id: 'catalyst',    label: 'Concrete catalyst bekend (earnings, product launch, sector rotation)' },
  { id: 'rr',         label: 'Risk/reward ratio ≥ 2:1' },
  { id: 'stoploss',   label: 'Stop-loss niveau bepaald VOOR instap' },
  { id: 'size',       label: 'Positiegrootte past binnen portfolio caps (max 12% single name)' },
  { id: 'sector',     label: 'Sector concentratie blijft onder 25% na toevoeging' },
  { id: 'macro',      label: 'Macro regime ondersteunt de positie (geen risk-off tijdens buy)' },
  { id: 'insider',    label: 'Geen grote insider sells in afgelopen 90 dagen' },
  { id: 'norevenge',  label: 'Niet kopen na recent verlies op zelfde ticker (revenge trade check)' },
  { id: 'cash',       label: 'Voldoende cash buffer blijft over na aankoop (min 5%)' },
]

type Action  = 'BUY' | 'SELL' | 'TRIM' | 'EXIT'
type Verdict = 'PROCEED' | 'WAIT' | 'ABORT'

const verdictStyles: Record<Verdict, { border: string; bg: string; text: string; pill: string }> = {
  PROCEED: { border: 'var(--success-text)', bg: 'var(--success-bg)', text: 'var(--success-text)', pill: 'pill pill-success' },
  WAIT:    { border: 'var(--warning-text)', bg: 'var(--warning-bg)', text: 'var(--warning-text)', pill: 'pill pill-warning' },
  ABORT:   { border: 'var(--danger-text)',  bg: 'var(--danger-bg)',  text: 'var(--danger-text)',  pill: 'pill pill-danger'  },
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function ValidatorView() {
  const positions  = useDashboardStore(s => s.positions)
  const watchlist  = useDashboardStore(s => s.watchlist)
  const prices     = useDashboardStore(s => s.prices)
  const railwayUrl = useDashboardStore(s => s.railwayUrl)
  const settings   = useDashboardStore(s => s.settings)
  const cash       = useDashboardStore(s => s.cash)

  // Form state
  const [ticker,      setTicker]      = useState('')
  const [action,      setAction]      = useState<Action>('BUY')
  const [entryPrice,  setEntryPrice]  = useState('')
  const [stopLoss,    setStopLoss]    = useState('')
  const [takeProfit1, setTakeProfit1] = useState('')
  const [takeProfit2, setTakeProfit2] = useState('')
  const [posSize,     setPosSize]     = useState('3')
  const [thesis,      setThesis]      = useState('')
  const [conviction,  setConviction]  = useState(3)
  const [checklist,   setChecklist]   = useState<Record<string, boolean>>({})
  const [deepResult,  setDeepResult]  = useState<{ verdict: Verdict; reasoning: string; rrScore: number } | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Auto-fill from portfolio / watchlist
  function autoFill(t: string) {
    const tickerUp = t.toUpperCase()
    setTicker(tickerUp)
    const pos = positions.find(p => p.ticker === tickerUp)
    const wat = watchlist.find(w => w.ticker === tickerUp)
    const lp  = prices[tickerUp]
    if (lp) {
      setEntryPrice(lp.toFixed(2))
      setStopLoss((lp * 0.92).toFixed(2))
      setTakeProfit1((lp * 1.08).toFixed(2))
      setTakeProfit2((lp * 1.18).toFixed(2))
    }
    if (pos?.thesis) setThesis(pos.thesis)
    if (pos?.conviction) setConviction(pos.conviction)
    if (wat?.reason) setThesis(wat.reason)
  }

  // Local calculations
  const calc = useMemo(() => {
    const ep = parseFloat(entryPrice)
    const sl = parseFloat(stopLoss)
    const tp = parseFloat(takeProfit1)
    const tp2 = parseFloat(takeProfit2)
    if (!ep || !sl || !tp || ep <= 0 || sl >= ep) return null

    const risk   = ep - sl
    const reward = tp - ep
    const rr     = risk > 0 ? reward / risk : 0

    // Portfolio metrics
    const totalPortValue = positions.reduce(
      (s, p) => s + (prices[p.ticker] ?? p.currentPrice) * p.shares, 0,
    ) + cash
    const targetEur     = totalPortValue * (parseFloat(posSize) / 100)
    const sharesToBuy   = ep > 0 ? Math.floor(targetEur / ep) : 0
    const actualEur     = sharesToBuy * ep
    const actualPct     = totalPortValue > 0 ? (actualEur / totalPortValue) * 100 : 0

    // Cap checks
    const existingPos   = positions.find(p => p.ticker === ticker.toUpperCase())
    const existingVal   = existingPos ? (prices[existingPos.ticker] ?? existingPos.currentPrice) * existingPos.shares : 0
    const newTotalForTicker = existingVal + actualEur
    const newTickerPct  = totalPortValue > 0 ? (newTotalForTicker / totalPortValue) * 100 : 0

    // Sector after trade
    const tickerSector  = existingPos?.sector ?? ''
    const sectorVal     = positions
      .filter(p => p.sector === tickerSector)
      .reduce((s, p) => s + (prices[p.ticker] ?? p.currentPrice) * p.shares, 0)
    const newSectorPct  = totalPortValue > 0 ? ((sectorVal + actualEur) / totalPortValue) * 100 : 0

    // Cash after
    const cashAfter     = cash - actualEur
    const cashPctAfter  = totalPortValue > 0 ? (cashAfter / totalPortValue) * 100 : 0

    return {
      rr: Math.round(rr * 10) / 10,
      risk,
      reward,
      maxLoss:      sharesToBuy * risk,
      maxGain:      sharesToBuy * reward,
      maxGain2:     sharesToBuy * (tp2 - ep),
      sharesToBuy,
      actualEur,
      actualPct,
      newTickerPct,
      newSectorPct,
      cashAfter,
      cashPctAfter,
      singleNameCap: settings.caps.singleName,
      sectorCap:     settings.caps.sector,
      singleBreached: newTickerPct > settings.caps.singleName,
      sectorBreached: newSectorPct > settings.caps.sector,
      cashBreached:   cashPctAfter < 5,
    }
  }, [entryPrice, stopLoss, takeProfit1, takeProfit2, posSize, ticker, positions, prices, cash, settings, watchlist])

  // Local verdict
  const localVerdict = useMemo((): Verdict | null => {
    if (!calc) return null
    const checksPassed = Object.values(checklist).filter(Boolean).length
    if (calc.singleBreached || calc.sectorBreached) return 'ABORT'
    if (calc.rr < 1.5 || checksPassed < 6) return 'WAIT'
    if (calc.rr >= 2 && checksPassed >= 8 && conviction >= 3) return 'PROCEED'
    return 'WAIT'
  }, [calc, checklist, conviction])

  // Deep validation via Railway
  async function runDeepValidation() {
    if (!railwayUrl || !ticker.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/railway/trade-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), action, thesis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`)
      setDeepResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.')
    } finally {
      setLoading(false)
    }
  }

  const allTickers = [
    ...positions.map(p => p.ticker),
    ...watchlist.map(w => w.ticker).filter(t => !positions.find(p => p.ticker === t)),
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--danger-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--danger-text)' }}>🔍 Trade Validator · Critical Committee</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--danger-text)', opacity: 0.7 }}>
          Bereken R/R, check portfolio caps, run pre-trade checklist — vóór je handelt.
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--danger-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--danger-text)', lineHeight: 1.6 }}>
            Vier checks: Conviction · R/R ratio · Portfolio caps · Pre-trade checklist. Resultaat: PROCEED / WAIT / ABORT. Geen automatische uitvoering — jij beslist.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left: input form ── */}
        <div className="space-y-4">
          <div className="surface p-4 space-y-3">
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Trade invoer</div>

            {/* Ticker + quick-pick */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ticker</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticker}
                  onChange={e => autoFill(e.target.value)}
                  placeholder="AAPL"
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                />
                <select
                  className="rounded-lg px-2 py-2 text-xs"
                  style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)' }}
                  onChange={e => autoFill(e.target.value)}
                  value=""
                >
                  <option value="">Portfolio/Watch</option>
                  {allTickers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Action */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Actie</label>
              <div className="flex gap-2">
                {(['BUY', 'TRIM', 'EXIT', 'SELL'] as Action[]).map(a => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className="rounded px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: action === a ? (a === 'BUY' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--bg)',
                      color: action === a ? (a === 'BUY' ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--text-secondary)',
                      border: '0.5px solid var(--border)',
                    }}
                  >{a}</button>
                ))}
              </div>
            </div>

            {/* Price levels */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Entry prijs (€)', value: entryPrice, set: setEntryPrice },
                { label: 'Stop-loss (€)', value: stopLoss, set: setStopLoss },
                { label: 'Take profit 1 (€)', value: takeProfit1, set: setTakeProfit1 },
                { label: 'Take profit 2 (€)', value: takeProfit2, set: setTakeProfit2 },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="w-full rounded px-2 py-1.5 text-sm font-mono focus:outline-none"
                    style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
            </div>

            {/* Position size + conviction */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Positiegrootte (%)</label>
                <input
                  type="number" step="0.5" min="0.5" max="15"
                  value={posSize}
                  onChange={e => setPosSize(e.target.value)}
                  className="w-full rounded px-2 py-1.5 text-sm font-mono focus:outline-none"
                  style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Conviction (1–5)</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setConviction(n)}
                      className="flex-1 rounded py-1.5 text-xs font-bold"
                      style={{
                        background: conviction >= n ? 'var(--primary)' : 'var(--bg)',
                        color: conviction >= n ? 'white' : 'var(--text-tertiary)',
                        border: '0.5px solid var(--border)',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Thesis */}
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Thesis</label>
              <textarea
                value={thesis}
                onChange={e => setThesis(e.target.value)}
                placeholder="Beschrijf de reden voor deze trade…"
                rows={2}
                className="w-full rounded px-2 py-1.5 text-sm resize-none focus:outline-none"
                style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Pre-trade checklist */}
          <div className="surface p-4">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              ✓ Pre-trade checklist
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} voltooid
              </span>
            </div>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map(item => (
                <label key={item.id} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[item.id] ?? false}
                    onChange={e => setChecklist(prev => ({ ...prev, [item.id]: e.target.checked }))}
                    className="mt-0.5 shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-xs leading-relaxed" style={{ color: checklist[item.id] ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: results ── */}
        <div className="space-y-4">
          {/* R/R Calculations */}
          {calc && (
            <div className="surface p-4 space-y-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>R/R Berekening</div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded p-2" style={{ background: 'var(--danger-bg)' }}>
                  <div className="text-xs" style={{ color: 'var(--danger-text)' }}>Max verlies</div>
                  <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--danger-text)' }}>−€{fmt(calc.maxLoss, 0)}</div>
                </div>
                <div className="rounded p-2" style={{ background: calc.rr >= 2 ? 'var(--success-bg)' : calc.rr >= 1.5 ? 'var(--warning-bg)' : 'var(--danger-bg)' }}>
                  <div className="text-xs" style={{ color: calc.rr >= 2 ? 'var(--success-text)' : calc.rr >= 1.5 ? 'var(--warning-text)' : 'var(--danger-text)' }}>R/R ratio</div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: calc.rr >= 2 ? 'var(--success-text)' : calc.rr >= 1.5 ? 'var(--warning-text)' : 'var(--danger-text)' }}>{calc.rr}:1</div>
                </div>
                <div className="rounded p-2" style={{ background: 'var(--success-bg)' }}>
                  <div className="text-xs" style={{ color: 'var(--success-text)' }}>Max winst (TP1)</div>
                  <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--success-text)' }}>+€{fmt(calc.maxGain, 0)}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Aandelen te kopen', value: `${calc.sharesToBuy} shares` },
                  { label: 'Investering', value: `€${fmt(calc.actualEur, 0)} (${fmt(calc.actualPct, 1)}%)` },
                  { label: 'Na trade: ticker gewicht', value: `${fmt(calc.newTickerPct, 1)}%`, warn: calc.singleBreached, cap: `cap ${calc.singleNameCap}%` },
                  { label: 'Na trade: sector gewicht', value: `${fmt(calc.newSectorPct, 1)}%`, warn: calc.sectorBreached, cap: `cap ${settings.caps.sector}%` },
                  { label: 'Cash na trade', value: `€${fmt(calc.cashAfter, 0)} (${fmt(calc.cashPctAfter, 1)}%)`, warn: calc.cashBreached, cap: 'min 5%' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span className={row.warn ? 'font-semibold' : ''} style={{ color: row.warn ? 'var(--danger-text)' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {row.value}
                      {row.warn && row.cap && <span className="ml-1 text-xs" style={{ color: 'var(--danger-text)' }}>⚠ &gt; {row.cap}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Local verdict */}
          {localVerdict && calc && (() => {
            const s = verdictStyles[localVerdict]
            const checksPassed = Object.values(checklist).filter(Boolean).length
            return (
              <div className="rounded-xl p-4 space-y-3" style={{ border: `1px solid ${s.border}`, background: s.bg }}>
                <div className="flex items-center gap-3">
                  <span className={s.pill}>{localVerdict}</span>
                  <span className="font-bold" style={{ color: s.text }}>
                    {localVerdict === 'PROCEED' ? '✓ Ga verder' : localVerdict === 'WAIT' ? '◑ Wacht nog' : '⛔ Niet doen'}
                  </span>
                </div>
                <div className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {calc.rr < 2 && <div>⚠ R/R {calc.rr}:1 — minimum 2:1 voor PROCEED</div>}
                  {calc.singleBreached && <div>⚠ Single-name cap overschreden na trade ({fmt(calc.newTickerPct, 1)}% &gt; {calc.singleNameCap}%)</div>}
                  {calc.sectorBreached && <div>⚠ Sector cap overschreden na trade ({fmt(calc.newSectorPct, 1)}% &gt; {settings.caps.sector}%)</div>}
                  {calc.cashBreached && <div>⚠ Cash te laag na trade ({fmt(calc.cashPctAfter, 1)}%)</div>}
                  {checksPassed < 8 && <div>⚠ Pre-trade checklist: {checksPassed}/{CHECKLIST_ITEMS.length} — run volledige checklist eerst</div>}
                  {localVerdict === 'PROCEED' && <div>✓ R/R ratio goed · caps intact · checklist compleet</div>}
                </div>
              </div>
            )
          })()}

          {/* Deep validation via Railway */}
          {railwayUrl && (
            <div className="surface p-4 space-y-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>🧠 Deep AI Validation</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Claude analyse via Railway backend — ~€0.15 per call</div>
              <button
                onClick={runDeepValidation}
                disabled={loading || !ticker.trim()}
                className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck size={13} />
                {loading ? 'Analyseren…' : 'Run Deep Validation'}
              </button>
              {error && (
                <div className="text-xs rounded p-2" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                  {error}
                </div>
              )}
              {deepResult && (() => {
                const s = verdictStyles[deepResult.verdict]
                return (
                  <div className="rounded p-3 space-y-2" style={{ border: `1px solid ${s.border}`, background: s.bg }}>
                    <div className="flex items-center gap-2">
                      <span className={s.pill}>{deepResult.verdict}</span>
                      <span className="text-sm font-bold" style={{ color: s.text }}>AI verdict</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{deepResult.reasoning}</p>
                    {deepResult.rrScore != null && (
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        R/R Score: <strong style={{ color: s.text }}>{deepResult.rrScore?.toFixed(1)}</strong>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {!railwayUrl && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <AlertTriangle size={13} className="shrink-0" />
              Deep AI validation vereist Railway backend — configureer in Settings.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
