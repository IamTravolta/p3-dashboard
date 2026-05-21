'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, BookOpen } from 'lucide-react'

interface ThesisEntry {
  id:          string
  ticker:      string
  thesis:      string
  catalysts:   string | null
  risks:       string | null
  version:     number
  created_at:  string
}

export default function ThesisView() {
  const [entries,  setEntries]  = useState<ThesisEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/thesis')
      const j = await r.json()
      setEntries(j.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Group by ticker
  const grouped = entries.reduce<Record<string, ThesisEntry[]>>((acc, e) => {
    if (!acc[e.ticker]) acc[e.ticker] = []
    acc[e.ticker].push(e)
    return acc
  }, {})

  async function deleteEntry(id: string) {
    if (!confirm('Delete this thesis version?')) return
    await fetch(`/api/thesis/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>📖 Thesis</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Investment thesis per position — your reasoning documented</div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary flex items-center gap-1.5"
          >
            <Plus size={14} /> New thesis
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>Write and track your investment thesis for each position. Revisit when signals change to see if your original reasoning still holds.</div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="surface p-10 text-center">
          <BookOpen size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No theses recorded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Track your investment reasoning and how it evolves.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([ticker, versions]) => {
            const latest = versions[0]
            const isOpen = expanded === ticker
            return (
              <div key={ticker} className="surface overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : ticker)}
                  className="w-full flex items-center justify-between px-5 py-4 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{ticker}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--purple-bg)', color: 'var(--purple-text)' }}>v{latest.version}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{versions.length} version{versions.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(latest.created_at).toLocaleDateString()}</span>
                    {isOpen
                      ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} />
                      : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '0.5px solid var(--border)' }}>
                    {versions.map((v) => (
                      <div key={v.id} className="px-5 py-4 space-y-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>v{v.version}</span>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(v.created_at).toLocaleString()}</span>
                          </div>
                          <button onClick={() => deleteEntry(v.id)} className="p-1 rounded transition" style={{ color: 'var(--text-tertiary)' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Thesis</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{v.thesis}</p>
                        </div>

                        {v.catalysts && (
                          <div>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--success-text)' }}>Catalysts</p>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{v.catalysts}</p>
                          </div>
                        )}

                        {v.risks && (
                          <div>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--danger-text)' }}>Risks</p>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{v.risks}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddThesisModal onClose={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

/* ── Add thesis modal ───────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
}
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition'

function AddThesisModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ ticker: '', thesis: '', catalysts: '', risks: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const r = await fetch('/api/thesis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ticker: form.ticker.toUpperCase() }),
    })
    const j = await r.json()
    if (j.error) { setError(j.error); setLoading(false); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '0.5px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>New thesis</h3>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ticker *</label>
            <input required value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="NVDA" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Investment thesis *</label>
            <textarea required rows={5} value={form.thesis} onChange={(e) => setForm(f => ({ ...f, thesis: e.target.value }))} placeholder="Why is this a good investment? What's the core thesis?" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--success-text)' }}>Catalysts (optional)</label>
            <textarea rows={3} value={form.catalysts} onChange={(e) => setForm(f => ({ ...f, catalysts: e.target.value }))} placeholder="Earnings beat, product launch, regulatory approval…" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--danger-text)' }}>Risks (optional)</label>
            <textarea rows={3} value={form.risks} onChange={(e) => setForm(f => ({ ...f, risks: e.target.value }))} placeholder="Competition, macro headwinds, valuation stretch…" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          {error && <p className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)' }}>{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Saving…' : 'Save thesis'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
