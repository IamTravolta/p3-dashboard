'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Newspaper, Clock } from 'lucide-react'

interface Briefing {
  content:      string
  generated_at: string
}

export default function BriefingView() {
  const [briefing,  setBriefing]  = useState<Briefing | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [cached,    setCached]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

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

  // Format markdown-like content into React (simple — handles **bold** and numbered lists)
  function formatContent(text: string) {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) return <div key={i} className="h-3" />

      // Bold headings: **text**
      const boldRegex = /\*\*(.+?)\*\*/g
      const parts: (string | React.ReactElement)[] = []
      let last = 0; let match: RegExpExecArray | null

      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > last) parts.push(trimmed.slice(last, match.index))
        parts.push(<strong key={match.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{match[1]}</strong>)
        last = match.index + match[0].length
      }
      if (last < trimmed.length) parts.push(trimmed.slice(last))

      // Detect numbered list or bullet
      if (/^\d+\./.test(trimmed)) {
        return (
          <div key={i} className="flex gap-2 mt-3">
            <span className="font-mono text-sm shrink-0" style={{ color: 'var(--primary)' }}>{trimmed.split('.')[0]}.</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{parts.slice(1)}</p>
          </div>
        )
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="shrink-0 mt-1" style={{ color: 'var(--text-tertiary)' }}>•</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{parts.slice(1)}</p>
          </div>
        )
      }

      return <p key={i} className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>{parts}</p>
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>📰 Daily Briefing</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.85 }}>AI-generated portfolio &amp; market summary — cached for 4 hours</div>
          </div>
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
        <div className="surface p-6">
          <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: '0.5px solid var(--border)' }}>
            <Newspaper size={15} style={{ color: 'var(--primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {new Date(briefing.generated_at).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {cached && (
              <div className="ml-auto flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <Clock size={11} />
                Cached
              </div>
            )}
          </div>
          <div className="space-y-1">
            {formatContent(briefing.content)}
          </div>
        </div>
      )}
    </div>
  )
}
