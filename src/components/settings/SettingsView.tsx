'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw } from 'lucide-react'

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

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => { if (j.settings) setSettings(j.settings) })
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) return <div className="py-20 text-center text-zinc-500 text-sm">Loading settings…</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Customise your dashboard behaviour and signal weights</p>
      </div>

      {/* Currency */}
      <Section title="Display">
        <Field label="Currency">
          <select value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} className={SELECT}>
            {['EUR', 'USD', 'GBP'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Theme">
          <select value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))} className={SELECT}>
            <option value="dark">Dark</option>
            <option value="light">Light (coming soon)</option>
          </select>
        </Field>
      </Section>

      {/* Factor weights */}
      <Section title="Factor weights">
        <p className="text-xs text-zinc-500 mb-4">
          Controls how factor scores (Q/G/V/M/S) are weighted into the composite stock score.
          Sum: <span className={Math.abs(weightSum - 1) < 0.01 ? 'text-emerald-400' : 'text-red-400'}>
            {(weightSum * 100).toFixed(0)}%
          </span> {Math.abs(weightSum - 1) > 0.01 && '(should be 100%)'}
        </p>
        <div className="space-y-4">
          {(Object.keys(settings.factor_weights) as (keyof typeof DEFAULT.factor_weights)[]).map((k) => (
            <div key={k}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300">{FACTOR_LABELS[k]}</span>
                <span className="text-zinc-400 font-mono">{(settings.factor_weights[k] * 100).toFixed(0)}%</span>
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
            <span className="text-sm font-mono text-white w-12">{(settings.max_position_pct * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">Alert when a position exceeds this % of total portfolio</p>
        </Field>
      </Section>

      {/* Briefing */}
      <Section title="Daily briefing">
        <Field label="Briefing hour (local time)">
          <select
            value={settings.briefing_hour}
            onChange={(e) => setSettings((s) => ({ ...s, briefing_hour: parseInt(e.target.value) }))}
            className={SELECT}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving || Math.abs(weightSum - 1) > 0.01}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
        {Math.abs(weightSum - 1) > 0.01 && (
          <span className="text-xs text-red-400">Factor weights must sum to 100%</span>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300 border-b border-zinc-800 pb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

const SELECT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'
