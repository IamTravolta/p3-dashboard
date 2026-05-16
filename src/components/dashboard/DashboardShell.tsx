'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDashboardStore } from '@/lib/store'

interface DashboardShellProps {
  user:     User
  children: React.ReactNode
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const setUserId  = useDashboardStore((s) => s.setUserId)
  const activeTab  = useDashboardStore((s) => s.activeTab)
  const setActive  = useDashboardStore((s) => s.setActiveTab)
  const isSyncing  = useDashboardStore((s) => s.isSyncing)
  const reset      = useDashboardStore((s) => s.reset)
  const supabase   = createClient()

  // Hydrate user id on mount
  useEffect(() => {
    setUserId(user.id)
  }, [user.id, setUserId])

  async function handleSignOut() {
    await supabase.auth.signOut()
    reset()
    window.location.href = '/auth/login'
  }

  const NAV_TABS = [
    { id: 'portfolio',   label: 'Portfolio',   icon: '📊' },
    { id: 'watchlist',   label: 'Watchlist',   icon: '👁' },
    { id: 'signals',     label: 'Signals',     icon: '🔬' },
    { id: 'paper',       label: 'Paper Trades', icon: '📝' },
    { id: 'thesis',      label: 'Thesis',      icon: '📖' },
    { id: 'behavioral',  label: 'Behavior',    icon: '🧠' },
    { id: 'briefing',   label: 'Briefing',    icon: '📰' },
    { id: 'settings',   label: 'Settings',    icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">P3</span>
            <span className="hidden text-xs text-zinc-500 sm:block">Portfolio Platform</span>
          </div>

          <div className="flex items-center gap-3">
            {isSyncing && (
              <span className="flex items-center gap-1 text-xs text-indigo-400">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                </svg>
                Syncing…
              </span>
            )}
            <span className="hidden text-xs text-zinc-500 sm:block">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="mx-auto max-w-screen-xl overflow-x-auto px-4">
          <div className="flex gap-0.5 pb-0">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`
                  flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition
                  ${activeTab === tab.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}
                `}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
