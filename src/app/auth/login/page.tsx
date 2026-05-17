'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Flow    = 'supabase' | 'custom'
type Channel = 'email' | 'sms'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [sentTo,     setSentTo]     = useState('')
  const [flow,       setFlow]       = useState<Flow>('supabase')
  const [channel,    setChannel]    = useState<Channel>('email')
  const [token,      setToken]      = useState('')
  const [step,       setStep]       = useState<'identifier' | 'token'>('identifier')
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const router = useRouter()

  // ── Step 1 — request code ─────────────────────────────────────────────────
  async function handleIdentifierSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res  = await fetch('/api/auth/otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ identifier }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error ?? 'Failed to send code'); return }

    setSentTo(json.sentTo)
    setFlow(json.flow)
    setChannel(json.channel)
    setStep('token')
  }

  // ── Step 2 — verify code ──────────────────────────────────────────────────
  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (flow === 'supabase') {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email: sentTo,
        token,
        type:  'email',
      })
      setLoading(false)
      if (error) setError(error.message)
      else router.push('/')
    } else {
      const res  = await fetch('/api/auth/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sentTo, channel, code: token }),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Invalid code'); return }
      window.location.href = json.redirectTo
    }
  }

  const channelLabel = channel === 'sms' ? 'SMS' : 'email'

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">P3 Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Personal Portfolio &amp; Prediction Platform</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          {step === 'identifier' ? (
            <form onSubmit={handleIdentifierSubmit} className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Email or phone number
                </label>
                <input
                  id="identifier"
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +31612345678"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  Use your primary email, a linked email, or a registered phone number
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div className="text-center pb-1 space-y-1">
                <p className="text-sm text-zinc-400">
                  {channel === 'sms' ? 'SMS sent to' : 'Code sent to'}
                </p>
                <p className="text-sm font-medium text-white break-all">{sentTo}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  channel === 'sms'
                    ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400'
                    : 'bg-indigo-600/20 border border-indigo-600/40 text-indigo-400'
                }`}>
                  via {channelLabel.toUpperCase()}
                </span>
              </div>

              <div>
                <label htmlFor="token" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  6-digit code
                </label>
                <input
                  id="token"
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition tracking-widest text-center font-mono"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || token.length < 6}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Verifying…' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('identifier'); setToken(''); setSentTo(''); setError(null) }}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 underline"
              >
                Try a different email or number
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
