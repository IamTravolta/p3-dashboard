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
        parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>)
        last = match.index + match[0].length
      }
      if (last < trimmed.length) parts.push(trimmed.slice(last))

      // Detect numbered list or bullet
      if (/^\d+\./.test(trimmed)) {
        return (
          <div key={i} className="flex gap-2 mt-3">
            <span className="text-indigo-400 font-mono text-sm shrink-0">{trimmed.split('.')[0]}.</span>
            <p className="text-sm text-zinc-300 leading-relaxed">{parts.slice(1)}</p>
          </div>
        )
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-zinc-500 shrink-0 mt-1">•</span>
            <p className="text-sm text-zinc-300 leading-relaxed">{parts.slice(1)}</p>
          </div>
        )
      }

      return <p key={i} className="text-sm text-zinc-300 leading-relaxed mt-2">{parts}</p>
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Daily Briefing</h2>
          <p className="text-xs text-zinc-500 mt-0.5">AI-generated portfolio & market summary — cached for 4 hours</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50 transition"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Regenerate
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>
      )}

      {loading && !briefing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <RefreshCw size={20} className="animate-spin mx-auto mb-3 text-indigo-400" />
          <p className="text-sm text-zinc-400">Generating your briefing…</p>
          <p className="text-xs text-zinc-600 mt-1">Claude is reading your portfolio and market signals</p>
        </div>
      )}

      {briefing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-zinc-800">
            <Newspaper size={15} className="text-indigo-400" />
            <span className="text-sm font-medium text-zinc-300">
              {new Date(briefing.generated_at).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {cached && (
              <div className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
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
