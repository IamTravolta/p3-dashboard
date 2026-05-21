'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Newspaper, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface Briefing {
  content:      string
  generated_at: string
}

// ── Priority categories ───────────────────────────────────────────────────────

type Priority = 'urgent' | 'warning' | 'positive' | 'opportunity' | 'info'

interface BriefingItem {
  priority: Priority
  heading:  string
  body:     string
  action?:  string
}

const PRIORITY_META: Record<Priority, {
  label: string
  emoji: string
  borderColor: string
  bgVar: string
  textVar: string
}> = {
  urgent:      { label: 'URGENT',      emoji: '🔴', borderColor: 'var(--danger-text)',  bgVar: 'var(--danger-bg)',  textVar: 'var(--danger-text)'  },
  warning:     { label: 'WAARSCHUWING',emoji: '🟠', borderColor: 'var(--warning-text)', bgVar: 'var(--warning-bg)', textVar: 'var(--warning-text)' },
  positive:    { label: 'POSITIEF',    emoji: '🟢', borderColor: 'var(--success-text)', bgVar: 'var(--success-bg)', textVar: 'var(--success-text)' },
  opportunity: { label: 'KANS',        emoji: '🔵', borderColor: 'var(--info-text)',    bgVar: 'var(--info-bg)',    textVar: 'var(--info-text)'    },
  info:        { label: 'INFO',        emoji: '⚪', borderColor: 'var(--border)',        bgVar: 'var(--surface)',    textVar: 'var(--text-secondary)'},
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse raw briefing text into prioritised items.
 *
 * Heuristic rules:
 *   - Lines containing URGENT/DRINGEND/KRITIEK → urgent
 *   - Lines containing RISICO/GEVAAR/SELL/TRIM/EXIT/WAARSCHUWING → warning
 *   - Lines containing KOOP/BUY/KANS/OPPORTUNITY → opportunity
 *   - Lines containing POSITIEF/STIJG/WINST/PROFIT/GOED/STRONG → positive
 *   - Everything else → info
 *
 * Groups by numbered sections or **bold** headers.
 */
function parseBriefing(text: string): BriefingItem[] {
  const lines   = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const items:  BriefingItem[] = []
  let current: Partial<BriefingItem> | null = null

  function flush() {
    if (current?.heading && current?.body !== undefined) {
      items.push({
        priority: current.priority ?? 'info',
        heading:  current.heading,
        body:     current.body,
        action:   current.action,
      })
    }
    current = null
  }

  function detectPriority(text: string): Priority {
    const up = text.toUpperCase()
    if (/URGENT|DRINGEND|KRITIEK|IMMEDIATE|ONMIDDELLIJK/.test(up))    return 'urgent'
    if (/RISICO|GEVAAR|\bSELL\b|TRIM|EXIT|VERKOOP|WAARSCHUWING|RISK|CONCERN/.test(up)) return 'warning'
    if (/KOOP|\bBUY\b|KANS|OPPORTUNITY|ENTRY|INSTAP/.test(up))        return 'opportunity'
    if (/POSITIEF|STIJG|PROFIT|WINST|\bGROW|STRONG|UPGRADE|OUTPERFORM/.test(up)) return 'positive'
    return 'info'
  }

  for (const line of lines) {
    // Numbered section or **bold** header
    const isSection = /^\d+\./.test(line) || /^\*\*.*\*\*$/.test(line) || /^#{1,3}/.test(line)

    if (isSection) {
      flush()
      const heading = line
        .replace(/^\d+\.\s*/, '')
        .replace(/^\*\*(.+)\*\*$/, '$1')
        .replace(/^#{1,3}\s*/, '')
      current = { heading, body: '', priority: detectPriority(heading) }
      continue
    }

    // ACTION line
    if (/^(→|->|ACTIE:|ACTION:)/i.test(line)) {
      if (current) {
        current.action = line.replace(/^(→|->|ACTIE:|ACTION:)\s*/i, '')
      }
      continue
    }

    if (current) {
      current.body = current.body ? current.body + ' ' + line : line
      // Re-check priority if body adds context
      if (current.priority === 'info') {
        const p = detectPriority(line)
        if (p !== 'info') current.priority = p
      }
    } else {
      // Standalone line — create item
      current = { heading: line.slice(0, 80), body: '', priority: detectPriority(line) }
    }
  }
  flush()

  // If no items were parsed (text is unstructured), create single info item
  if (items.length === 0 && text.trim()) {
    items.push({ priority: 'info', heading: 'Briefing', body: text })
  }

  return items
}

// ── Priority ordering ─────────────────────────────────────────────────────────

const PRIORITY_ORDER: Priority[] = ['urgent', 'warning', 'opportunity', 'positive', 'info']

function sortItems(items: BriefingItem[]): BriefingItem[] {
  return [...items].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  )
}

// ── BriefingItem card ─────────────────────────────────────────────────────────

function BriefingCard({ item }: { item: BriefingItem }) {
  const [expanded, setExpanded] = useState(item.priority === 'urgent' || item.priority === 'warning')
  const meta = PRIORITY_META[item.priority]

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ borderLeft: `3px solid ${meta.borderColor}`, background: meta.bgVar }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{meta.emoji}</span>
          <span className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: meta.textVar, minWidth: 80 }}>
            {meta.label}
          </span>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {item.heading}
          </span>
        </div>
        <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (item.body || item.action) && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: `0.5px solid ${meta.borderColor}`, opacity: 0.9 }}>
          {item.body && (
            <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
              {item.body}
            </p>
          )}
          {item.action && (
            <div
              className="rounded px-3 py-2 flex items-start gap-2"
              style={{ background: 'var(--surface)' }}
            >
              <span className="font-bold shrink-0" style={{ color: meta.textVar, fontSize: 11 }}>→ ACTIE</span>
              <span className="text-xs font-medium leading-relaxed" style={{ color: meta.textVar }}>
                {item.action}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function BriefingView() {
  const [briefing,  setBriefing]  = useState<Briefing | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [cached,    setCached]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [rawMode,   setRawMode]   = useState(false)

  async function load(force = false) {
    setLoading(true); setError(null)
    try {
      const url = force ? '/api/briefing?refresh=1' : '/api/briefing'
      const r   = await fetch(url)
      const j   = await r.json()
      if (j.error) { setError(j.error); return }
      setBriefing(j.briefing)
      setCached(j.cached)
    } catch {
      setError('Failed to load briefing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const items = briefing ? sortItems(parseBriefing(briefing.content)) : []

  // Count by priority for summary strip
  const counts = items.reduce<Record<Priority, number>>((acc, i) => {
    acc[i.priority] = (acc[i.priority] ?? 0) + 1
    return acc
  }, {} as Record<Priority, number>)

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>📰 Daily Briefing</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>Morning briefing — macro + portfolio + signals combined</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRawMode((r) => !r)}
              className="btn"
              style={{ fontSize: 10, padding: '3px 10px', minHeight: 24 }}
            >
              {rawMode ? 'Priority view' : 'Raw text'}
            </button>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="btn flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>
            Items gesorteerd op prioriteit: URGENT → WAARSCHUWING → KANS → POSITIEF → INFO. Klik op een item om details te zien.
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>{error}</div>
      )}

      {loading && !briefing && (
        <div className="surface p-8 text-center">
          <RefreshCw size={20} className="animate-spin mx-auto mb-3" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Generating your briefing…</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Claude is reading your portfolio and market signals</p>
        </div>
      )}

      {briefing && (
        <>
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Newspaper size={12} style={{ color: 'var(--primary)' }} />
              {new Date(briefing.generated_at).toLocaleDateString('nl-NL', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </div>
            {cached && (
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <Clock size={11} />
                Cached
              </div>
            )}
            {/* Priority summary pills */}
            {!rawMode && items.length > 0 && (
              <div className="flex gap-1.5 flex-wrap ml-auto">
                {(Object.entries(counts) as [Priority, number][])
                  .sort((a, b) => PRIORITY_ORDER.indexOf(a[0]) - PRIORITY_ORDER.indexOf(b[0]))
                  .map(([p, n]) => (
                    <span key={p} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: PRIORITY_META[p].bgVar, color: PRIORITY_META[p].textVar }}>
                      {PRIORITY_META[p].emoji} {n}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {rawMode ? (
            /* Raw text view */
            <div className="surface p-6">
              {briefing.content.split('\n').map((line, i) => {
                const trimmed = line.trim()
                if (!trimmed) return <div key={i} className="h-3" />
                const isBold = /^\*\*.*\*\*$/.test(trimmed)
                return (
                  <p key={i} className="text-sm leading-relaxed mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {isBold
                      ? <strong style={{ color: 'var(--text-primary)' }}>{trimmed.replace(/^\*\*(.+)\*\*$/, '$1')}</strong>
                      : trimmed}
                  </p>
                )
              })}
            </div>
          ) : (
            /* Priority view */
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="surface py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Geen gestructureerde briefing items gevonden.</p>
                  <button onClick={() => setRawMode(true)} className="btn mt-3" style={{ fontSize: 11 }}>Bekijk ruwe tekst</button>
                </div>
              ) : (
                items.map((item, i) => <BriefingCard key={i} item={item} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
