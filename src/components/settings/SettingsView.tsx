'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, RefreshCw, Download, Upload, Link, Plus, Trash2, Mail } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface UserSettings {
  currency:          string
  factor_weights: {
    q: number
    g: number
    v: number
    m: number
    s: number
  }
  max_position_pct:  number
  briefing_hour:     number
  theme:             string
}

const DEFAULT: UserSettings = {
  currency:         'EUR',
  factor_weights:   { q: 0.25, g: 0.25, v: 0.20, m: 0.15, s: 0.15 },
  max_position_pct: 0.15,
  briefing_hour:    8,
  theme:            'dark',
}

const FACTOR_LABELS: Record<string, string> = {
  q: 'Quality',
  g: 'Growth',
  v: 'Valuation',
  m: 'Momentum',
  s: 'Sentiment',
}

const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
}
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none focus:outline-none transition'

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const railwayUrl      = useDashboardStore((s) => s.railwayUrl)
  const setRailwayUrl   = useDashboardStore((s) => s.setRailwayUrl)
  const storeSettings   = useDashboardStore((s) => s.settings)
  const setStoreSettings = useDashboardStore((s) => s.setSettings)
  const storeState      = useDashboardStore.getState
  const paperModeActive = useDashboardStore((s) => s.paperModeActive)
  const setPaperMode    = useDashboardStore((s) => s.setPaperMode)
  const [railwayInput,  setRailwayInput]  = useState(railwayUrl)
  const [railwayStatus, setRailwayStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [importError,   setImportError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => { if (j.settings) setSettings(j.settings) })
      .finally(() => setLoading(false))
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  function handleThemeChange(value: string) {
    setSettings((s) => ({ ...s, theme: value }))
    if (value === 'light') {
      showToast('Light mode coming soon — dark only for now')
    }
    try { localStorage.setItem('p3-theme', value) } catch {}
  }

  const weightSum = Object.values(settings.factor_weights).reduce((a, b) => a + b, 0)

  function setWeight(k: keyof typeof DEFAULT.factor_weights, v: number) {
    setSettings((s) => ({ ...s, factor_weights: { ...s.factor_weights, [k]: v } }))
  }

  async function save() {
    setSaving(true); setSaved(false)
    await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(settings),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveRailwayUrl() {
    const url = railwayInput.trim()
    setRailwayUrl(url)
    await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ railwayUrl: url }),
    })
  }

  async function testRailwayConnection() {
    setRailwayStatus('testing')
    try {
      const resp = await fetch('/api/railway/health')
      setRailwayStatus(resp.ok ? 'ok' : 'error')
    } catch {
      setRailwayStatus('error')
    }
    setTimeout(() => setRailwayStatus('idle'), 3000)
  }

  function exportData() {
    const state = storeState()
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `p3-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string)
        if (parsed.positions) useDashboardStore.getState().hydrate(parsed)
        if (parsed.railwayUrl) setRailwayUrl(parsed.railwayUrl)
      } catch {
        setImportError('Invalid JSON file — could not import')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading settings…</div>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-xl" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--primary)' }}>⚙ Settings</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--primary)', opacity: 0.7 }}>Platform configuration and preferences</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'rgba(91,141,238,0.08)' }}>
          <div className="text-xs" style={{ color: 'var(--primary)', lineHeight: 1.6 }}>Configure Railway backend, API keys, signal weights, risk parameters, and notification preferences.</div>
        </div>
      </div>

      {/* Railway Backend */}
      <Section title="Railway Backend">
        <p className="text-xs -mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Connect your Railway deployment to enable live signals, backtesting, and enrichment.
        </p>
        <Field label="Railway Backend URL">
          <div className="flex gap-2">
            <input
              type="text"
              value={railwayInput}
              onChange={(e) => setRailwayInput(e.target.value)}
              placeholder="https://your-project.up.railway.app"
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={saveRailwayUrl} className="btn flex items-center gap-1.5">
              <Save size={12} /> Save
            </button>
            <button
              onClick={testRailwayConnection}
              disabled={railwayStatus === 'testing'}
              className="btn flex items-center gap-1.5 disabled:opacity-50"
            >
              <Link size={12} />
              {railwayStatus === 'testing' ? 'Testing…' : 'Test'}
            </button>
          </div>
          {railwayStatus === 'ok'    && <p className="text-xs mt-1" style={{ color: 'var(--success-text)' }}>✓ CONNECTED</p>}
          {railwayStatus === 'error' && <p className="text-xs mt-1" style={{ color: 'var(--danger-text)' }}>✕ ERROR — could not reach backend</p>}
          {railwayUrl && railwayUrl === railwayInput && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Currently saved: {railwayUrl}</p>
          )}
        </Field>
      </Section>

      {/* Login Emails */}
      <LinkedEmailsSection />

      {/* Currency */}
      <Section title="Display">
        <Field label="Currency">
          <select value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} className={inputClass} style={inputStyle}>
            {['EUR', 'USD', 'GBP'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Theme">
          <select value={settings.theme} onChange={(e) => handleThemeChange(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Field>
        <Field label="Paper Mode">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Blocks real money execution reminders</p>
            </div>
            <button
              type="button"
              onClick={() => setPaperMode(!paperModeActive)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
              style={{ background: paperModeActive ? 'var(--warning-text)' : 'var(--border)' }}
            >
              <span
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: paperModeActive ? 'translateX(1rem)' : 'translateX(0.125rem)' }}
              />
            </button>
          </div>
        </Field>
      </Section>

      {/* Factor weights */}
      <Section title="Factor weights">
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Controls how factor scores (Q/G/V/M/S) are weighted into the composite stock score.
          Sum: <span style={{ color: Math.abs(weightSum - 1) < 0.01 ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {(weightSum * 100).toFixed(0)}%
          </span> {Math.abs(weightSum - 1) > 0.01 && '(should be 100%)'}
        </p>
        <div className="space-y-4">
          {(Object.keys(settings.factor_weights) as (keyof typeof DEFAULT.factor_weights)[]).map((k) => (
            <div key={k}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{FACTOR_LABELS[k]}</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{(settings.factor_weights[k] * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={settings.factor_weights[k]}
                onChange={(e) => setWeight(k, parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Portfolio limits */}
      <Section title="Portfolio limits">
        <Field label="Max position size">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.05}
              max={0.50}
              step={0.05}
              value={settings.max_position_pct}
              onChange={(e) => setSettings((s) => ({ ...s, max_position_pct: parseFloat(e.target.value) }))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm font-mono w-12" style={{ color: 'var(--text-primary)' }}>{(settings.max_position_pct * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Alert when a position exceeds this % of total portfolio</p>
        </Field>
      </Section>

      {/* Briefing */}
      <Section title="Daily briefing">
        <Field label="Briefing hour (local time)">
          <select
            value={settings.briefing_hour}
            onChange={(e) => setSettings((s) => ({ ...s, briefing_hour: parseInt(e.target.value) }))}
            className={inputClass}
            style={inputStyle}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </Field>
        <GenerateBriefingButton />
      </Section>

      {/* Portfolio Caps */}
      <Section title="Portfolio caps">
        <p className="text-xs -mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Maximum allocation limits — saved immediately to your local store.
        </p>
        <div className="space-y-4">
          {(Object.entries(storeSettings.caps) as [keyof typeof storeSettings.caps, number][]).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{CAP_LABELS[key] ?? key}</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{val}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={val}
                  onChange={(e) =>
                    setStoreSettings({ caps: { ...storeSettings.caps, [key]: parseInt(e.target.value) } })
                  }
                  className="flex-1 accent-indigo-500"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) =>
                    setStoreSettings({ caps: { ...storeSettings.caps, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) } })
                  }
                  className="w-16 rounded-lg px-2 py-1 text-xs text-right tabular-nums outline-none transition"
                  style={inputStyle}
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>%</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Import / Export */}
      <Section title="Import / Export">
        <p className="text-xs -mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Export your portfolio, watchlist, and settings as a JSON backup file.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className="btn flex items-center gap-2">
            <Download size={13} /> Export Data
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn flex items-center gap-2">
            <Upload size={13} /> Import Backup
          </button>
          <a href="/migrate" className="btn flex items-center gap-2">
            Import from Legacy Dashboard
          </a>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        {importError && <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{importError}</p>}
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Exports include positions, watchlist, settings, and Railway URL. Prices and signal cache are excluded.
        </p>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving || Math.abs(weightSum - 1) > 0.01}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm" style={{ color: 'var(--success-text)' }}>✓ Saved</span>}
        {Math.abs(weightSum - 1) > 0.01 && (
          <span className="text-xs" style={{ color: 'var(--danger-text)' }}>Factor weights must sum to 100%</span>
        )}
      </div>
    </div>
  )
}

// ── GenerateBriefingButton ─────────────────────────────────────────────────────

function GenerateBriefingButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function generate() {
    setStatus('loading')
    setErrMsg(null)
    try {
      const resp = await fetch('/api/briefing?refresh=1')
      const j = await resp.json()
      if (!resp.ok) throw new Error(j.error ?? 'Failed to generate briefing')
      setStatus('done')
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={generate}
        disabled={status === 'loading'}
        className="btn flex items-center gap-2 disabled:opacity-50"
      >
        {status === 'loading' ? (
          <>
            <RefreshCw size={13} className="animate-spin" />
            Generating…
          </>
        ) : (
          'Generate Briefing Now'
        )}
      </button>

      {status === 'done' && (
        <p className="text-xs" style={{ color: 'var(--success-text)' }}>
          Done!{' '}
          <button
            onClick={() => {
              useDashboardStore.getState().setActiveGroup('briefing', 'briefing')
            }}
            className="underline"
          >
            Go to Briefing tab
          </button>
        </p>
      )}

      {status === 'error' && (
        <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{errMsg ?? 'Generation failed'}</p>
      )}
    </div>
  )
}

// ── LinkedEmailsSection ───────────────────────────────────────────────────────

interface LinkedEmail {
  id: string
  email: string
  label: string | null
  created_at: string
}

function LinkedEmailsSection() {
  const [primary, setPrimary] = useState<string | null>(null)
  const [linked,  setLinked]  = useState<LinkedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-primary)',
  }
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition'

  useEffect(() => {
    fetch('/api/settings/emails')
      .then((r) => r.json())
      .then((j) => {
        if (j.primary) setPrimary(j.primary)
        if (j.linked)  setLinked(j.linked)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const res  = await fetch('/api/settings/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: newEmail, label: newLabel }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(json.error ?? 'Failed to add email'); return }
    setLinked((prev) => [...prev, json.linked])
    setNewEmail('')
    setNewLabel('')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/settings/emails/${id}`, { method: 'DELETE' })
    setLinked((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  return (
    <Section title="Login emails">
      <p className="text-xs -mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Add extra email addresses you can use to log in. When you enter a linked email
        at the login screen, the one-time code is sent to your primary email.
      </p>

      {loading ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <div className="space-y-2">
          {/* Primary email */}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ border: '0.5px solid var(--border)', background: 'var(--bg)' }}>
            <Mail size={13} className="shrink-0" style={{ color: 'var(--primary)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{primary}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Primary — OTP codes always go here</p>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-text)', color: 'var(--info-text)' }}>
              PRIMARY
            </span>
          </div>

          {/* Linked emails */}
          {linked.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
              <Mail size={13} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.email}</p>
                {item.label && <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{item.label}</p>}
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="shrink-0 rounded p-1 transition disabled:opacity-40"
                style={{ color: 'var(--text-tertiary)' }}
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Add form */}
          {adding ? (
            <form onSubmit={handleAdd} className="rounded-lg p-3 space-y-3" style={{ border: '0.5px solid var(--border)', background: 'var(--bg)' }}>
              <div className="space-y-2">
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="new@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Label (optional — e.g. Work, Personal)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              {err && <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{err}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !newEmail}
                  className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
                  {saving ? 'Adding…' : 'Add email'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewEmail(''); setNewLabel(''); setErr(null) }}
                  className="btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition w-full"
              style={{ border: '1px dashed var(--border)', color: 'var(--text-tertiary)', background: 'transparent' }}
            >
              <Plus size={12} /> Add login email
            </button>
          )}
        </div>
      )}
    </Section>
  )
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-5 space-y-4">
      <h3 className="text-sm font-medium pb-2" style={{ color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

const CAP_LABELS: Record<string, string> = {
  singleName: 'Single name',
  sector:     'Sector',
  regionUS:   'Region — US',
  regionEU:   'Region — EU',
  USD:        'USD exposure',
  cash:       'Cash buffer',
}
