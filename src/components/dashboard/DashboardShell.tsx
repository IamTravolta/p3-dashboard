'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDashboardStore } from '@/lib/store'

interface DashboardShellProps {
  user:     User
  children: React.ReactNode
}

// ── Navigation structure ──────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: '◇',
    subTabs: [
      { id: 'overview',   label: 'Overview' },
      { id: 'positions',  label: 'Positions' },
      { id: 'action',     label: 'Action Center' },
      { id: 'sizing',     label: 'Sizing' },
      { id: 'catalysts',  label: 'Catalysts' },
      { id: 'hedge',      label: 'Hedge' },
      { id: 'options',    label: 'Options' },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: '★',
    subTabs: [
      { id: 'watchlist',  label: 'Watchlist' },
      { id: 'ideas',      label: 'Trade Ideas' },
      { id: 'validator',  label: 'Validator' },
      { id: 'insider',    label: 'Insider Flow' },
      { id: 'smartmoney', label: 'Smart Money' },
      { id: 'earnings',   label: 'Earnings' },
      { id: 'momentum',   label: 'Momentum' },
      { id: 'correlations', label: 'Correlations' },
      { id: 'predictions', label: 'Prediction Mkts' },
    ],
  },
  {
    id: 'learnings',
    label: 'Learnings',
    icon: '⚗',
    subTabs: [
      { id: 'signals',    label: 'Signals' },
      { id: 'paper',      label: 'Paper Trades' },
      { id: 'thesis',     label: 'Thesis' },
      { id: 'behavioral', label: 'Behavior' },
      { id: 'backtest',   label: 'Backtest' },
      { id: 'sources',    label: 'Sources' },
    ],
  },
  {
    id: 'briefing',
    label: 'Briefing',
    icon: '📰',
    subTabs: [
      { id: 'briefing',   label: 'Daily Briefing' },
    ],
  },
  {
    id: 'settings',
    label: '⚙',
    icon: '',
    subTabs: [
      { id: 'settings',   label: 'Settings' },
    ],
  },
]

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const setUserId      = useDashboardStore((s) => s.setUserId)
  const activeGroup    = useDashboardStore((s) => s.activeGroup)
  const activeSubTab   = useDashboardStore((s) => s.activeSubTab)
  const setActiveGroup = useDashboardStore((s) => s.setActiveGroup)
  const setActiveSubTab = useDashboardStore((s) => s.setActiveSubTab)
  const isSyncing      = useDashboardStore((s) => s.isSyncing)
  const reset          = useDashboardStore((s) => s.reset)
  const supabase       = createClient()

  useEffect(() => {
    setUserId(user.id)
  }, [user.id, setUserId])

  async function handleSignOut() {
    await supabase.auth.signOut()
    reset()
    window.location.href = '/auth/login'
  }

  const currentGroup = NAV_GROUPS.find((g) => g.id === activeGroup)
  const subTabs      = currentGroup?.subTabs ?? []
  const showSubNav   = subTabs.length > 1

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-screen-xl px-4">
          {/* Primary row */}
          <div className="flex items-center gap-2 py-2.5">
            {/* Logo */}
            <span className="text-base font-bold tracking-tight text-white shrink-0">P3</span>
            <span className="hidden text-xs text-zinc-600 sm:block mr-3">Portfolio Platform</span>

            {/* Primary group nav */}
            <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none">
              {NAV_GROUPS.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`
                    flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition shrink-0
                    ${activeGroup === group.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
                  `}
                >
                  {group.icon && <span className="text-xs">{group.icon}</span>}
                  {group.label}
                </button>
              ))}
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2 ml-2 shrink-0">
              {isSyncing && (
                <span className="hidden items-center gap-1 text-xs text-indigo-400 sm:flex">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                  </svg>
                  Syncing
                </span>
              )}
              <span className="hidden text-xs text-zinc-600 sm:block max-w-[140px] truncate">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Secondary sub-tab row */}
          {showSubNav && (
            <div className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-none border-t border-zinc-800/60 pt-1 pb-1">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`
                    whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition shrink-0
                    ${activeSubTab === tab.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
