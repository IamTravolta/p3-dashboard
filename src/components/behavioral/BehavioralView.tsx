'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, TrendingUp, AlertCircle } from 'lucide-react'

interface BehavioralEntry {
  id:                    string
  ticker:                string | null
  action_type:           string
  system_recommendation: string | null
  user_action:           string
  followed_advice:       boolean | null
  context:               Record<string, unknown> | null
  created_at:            string
}

interface Stats {
  totalVerdicts:    number
  followed:         number
  overridden:       number
  ignored:          number
  followWinRate:    number
  overrideWinRate:  number
  followedCount:    number
  overriddenCount:  number
}

export default function BehavioralView() {
  const [entries,  setEntries]  = useState<BehavioralEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showLog,  setShowLog]  = useState(false)
  const [stats,    setStats]    = useState<Stats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/behavioral-log?limit=100')
      if (!resp.ok) return
      const { data } = await resp.json() as { data: BehavioralEntry[] }

      const rows = (data ?? []) as BehavioralEntry[]
      setEntries(rows)

      const total      = rows.length
      const followed   = rows.filter((r) => r.followed_advice === true).length
      const overridden = rows.filter((r) => r.followed_advice === false).length
      const ignored    = rows.filter((r) => r.followed_advice === null).length

      setStats({
        totalVerdicts:   total,
        followed,
        overridden,
        ignored,
        followWinRate:   0,
        overrideWinRate: 0,
        followedCount:   followed,
        overriddenCount: overridden,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function actionPillStyle(followed: boolean | null): React.CSSProperties {
    if (followed === true)  return { background: 'var(--success-bg)', color: 'var(--success-text)' }
    if (followed === false) return { background: 'var(--warning-bg)', color: 'var(--warning-text)' }
    return { background: 'var(--surface)', color: 'var(--text-secondary)' }
  }

  const actionLabel = (followed: boolean | null) =>
    followed === true ? 'FOLLOWED' : followed === false ? 'OVERRIDDEN' : 'IGNORED'

  const insight = () => {
    if (!stats || stats.followedCount < 3 && stats.overriddenCount < 3) return null
    if (stats.overriddenCount > stats.followedCount * 2) {
      return { text: 'You override recommendations frequently. Review your system settings to see if calibration is needed.', type: 'positive' }
    }
    if (stats.followedCount > stats.overriddenCount * 2) {
      return { text: 'You follow recommendations closely. Consider whether personal conviction should play a larger role.', type: 'info' }
    }
    return { text: 'Your override and follow balance looks healthy. Signals and intuition appear aligned.', type: 'neutral' }
  }

  const ins = insight()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>🧠 Behavioral</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Track behavioral biases and decision patterns</div>
          </div>
          <button
            onClick={() => setShowLog(true)}
            className="btn flex items-center gap-1.5"
          >
            <Brain size={14} /> Log decision
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>Log and review behavioral patterns. Identify systematic biases (FOMO, loss aversion, anchoring) before they impact performance.</div>
        </div>
      </div>

      {/* Insight banner */}
      {ins && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={ins.type === 'positive'
            ? { border: '1px solid var(--success-text)', background: 'var(--success-bg)' }
            : ins.type === 'info'
            ? { border: '1px solid var(--info-text)', background: 'var(--info-bg)' }
            : { border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ins.text}</p>
        </div>
      )}

      {/* Stats grid */}
      {stats && stats.totalVerdicts > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Verdicts logged" value={stats.totalVerdicts.toString()} />
          <StatCard label="Followed" value={`${stats.followed} (${stats.totalVerdicts > 0 ? Math.round(stats.followed / stats.totalVerdicts * 100) : 0}%)`} color="var(--success-text)" />
          <StatCard label="Overridden" value={`${stats.overridden} (${stats.totalVerdicts > 0 ? Math.round(stats.overridden / stats.totalVerdicts * 100) : 0}%)`} color="var(--warning-text)" />
          <StatCard label="Ignored" value={stats.ignored.toString()} color="var(--text-tertiary)" />
        </div>
      )}

      {/* Follow vs override breakdown */}
      {stats && stats.totalVerdicts > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="surface px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} style={{ color: 'var(--success-text)' }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Followed advice</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{stats.followedCount}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>decisions</p>
          </div>
          <div className="surface px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={14} style={{ color: 'var(--warning-text)' }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Overrode advice</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--warning-text)' }}>{stats.overriddenCount}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>decisions</p>
          </div>
        </div>
      )}

      {/* Log table */}
      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div className="surface p-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          No behavioral decisions logged yet. Start by logging a verdict action.
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Ticker', 'Action Type', 'Recommendation', 'Your action', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{e.ticker ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.action_type}</td>
                  <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{e.system_recommendation ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={actionPillStyle(e.followed_advice)}>
                      {actionLabel(e.followed_advice)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLog && <LogDecisionModal onClose={() => { setShowLog(false); load() }} />}
    </div>
  )
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

/* ── Log decision modal ─────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
}
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition'

function LogDecisionModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    ticker:                '',
    action_type:           'TRADE_DECISION',
    system_recommendation: '',
    followed_advice:       'true',
    context_note:          '',
  })
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/behavioral-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type:           form.action_type,
        ticker:                form.ticker.toUpperCase() || null,
        system_recommendation: form.system_recommendation || null,
        user_action:           form.followed_advice === 'true' ? 'FOLLOWED' : form.followed_advice === 'false' ? 'OVERRIDDEN' : 'IGNORED',
        followed_advice:       form.followed_advice === 'true' ? true : form.followed_advice === 'false' ? false : null,
        context:               form.context_note ? { note: form.context_note } : null,
      }),
    })

    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '0.5px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Log a decision</h3>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ticker (optional)</label>
              <input value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} className={inputClass} style={inputStyle} placeholder="NVDA" />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Action type</label>
              <select value={form.action_type} onChange={(e) => setForm(f => ({ ...f, action_type: e.target.value }))} className={inputClass} style={inputStyle}>
                {['TRADE_DECISION', 'REBALANCE', 'HEDGE', 'WATCHLIST_REVIEW', 'OTHER'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>System recommendation</label>
            <input value={form.system_recommendation} onChange={(e) => setForm(f => ({ ...f, system_recommendation: e.target.value }))} className={inputClass} style={inputStyle} placeholder="BUY, SELL, HOLD, or description…" />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Did you follow the recommendation?</label>
            <select value={form.followed_advice} onChange={(e) => setForm(f => ({ ...f, followed_advice: e.target.value }))} className={inputClass} style={inputStyle}>
              <option value="true">Yes — followed</option>
              <option value="false">No — overridden</option>
              <option value="null">Ignored / no action</option>
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
            <textarea rows={2} value={form.context_note} onChange={(e) => setForm(f => ({ ...f, context_note: e.target.value }))} placeholder="Reasoning, market conditions, conviction…" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Saving…' : 'Log decision'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
