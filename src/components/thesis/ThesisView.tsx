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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Thesis Tracker</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Versioned investment theses per position or watchlist item</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          <Plus size={14} /> New thesis
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Loading…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-400 text-sm">No theses recorded yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Track your investment reasoning and how it evolves.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([ticker, versions]) => {
            const latest = versions[0]   // sorted desc by version
            const isOpen = expanded === ticker
            return (
              <div key={ticker} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : ticker)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{ticker}</span>
                    <span className="rounded-full bg-indigo-900/40 text-indigo-300 text-xs px-2 py-0.5">v{latest.version}</span>
                    <span className="text-xs text-zinc-500">{versions.length} version{versions.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{new Date(latest.created_at).toLocaleDateString()}</span>
                    {isOpen ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-800 divide-y divide-zinc-800">
                    {versions.map((v) => (
                      <div key={v.id} className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-zinc-700 text-zinc-300 text-xs px-2 py-0.5">v{v.version}</span>
                            <span className="text-xs text-zinc-500">{new Date(v.created_at).toLocaleString()}</span>
                          </div>
                          <button onClick={() => deleteEntry(v.id)} className="text-zinc-600 hover:text-red-400 transition p-1 rounded">
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-zinc-400 mb-1">Thesis</p>
                          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{v.thesis}</p>
                        </div>

                        {v.catalysts && (
                          <div>
                            <p className="text-xs font-medium text-emerald-500 mb-1">Catalysts</p>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{v.catalysts}</p>
                          </div>
                        )}

                        {v.risks && (
                          <div>
                            <p className="text-xs font-medium text-red-400 mb-1">Risks</p>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{v.risks}</p>
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
const INPUT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="font-semibold text-white">New thesis</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-zinc-400">Ticker *</label>
            <input required value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="NVDA" className={INPUT} />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Investment thesis *</label>
            <textarea required rows={5} value={form.thesis} onChange={(e) => setForm(f => ({ ...f, thesis: e.target.value }))} placeholder="Why is this a good investment? What's the core thesis?" className={`${INPUT} resize-none`} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 text-emerald-500">Catalysts (optional)</label>
            <textarea rows={3} value={form.catalysts} onChange={(e) => setForm(f => ({ ...f, catalysts: e.target.value }))} placeholder="Earnings beat, product launch, regulatory approval…" className={`${INPUT} resize-none`} />
          </div>
          <div>
            <label className="text-xs text-red-400">Risks (optional)</label>
            <textarea rows={3} value={form.risks} onChange={(e) => setForm(f => ({ ...f, risks: e.target.value }))} placeholder="Competition, macro headwinds, valuation stretch…" className={`${INPUT} resize-none`} />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Saving…' : 'Save thesis'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
