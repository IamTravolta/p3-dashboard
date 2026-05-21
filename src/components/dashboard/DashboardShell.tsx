'use client'

import { createClient }      from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import dynamic from 'next/dynamic'

const TickerModal = dynamic(() => import('@/components/shared/TickerModal'), { ssr: false })

// ── Sync-age label ("Sync 2m ago" / "Syncing…") ──────────────────────────────
function SyncStatus({ isSyncing, lastFetched }: { isSyncing: boolean; lastFetched: number | null }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!lastFetched) return
    function update() {
      const sec = Math.floor((Date.now() - lastFetched!) / 1000)
      if (sec < 60)        setLabel('Sync <1m ago')
      else if (sec < 3600) setLabel(`Sync ${Math.floor(sec / 60)}m ago`)
      else                 setLabel(`Sync ${Math.floor(sec / 3600)}h ago`)
    }
    update()
    const t = setInterval(update, 30_000)
    return () => clearInterval(t)
  }, [lastFetched])

  if (isSyncing) return (
    <span className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
      Syncing…
    </span>
  )

  if (!label) return null

  return (
    <span className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-tertiary)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success-text)' }} />
      {label}
    </span>
  )
}

// ── Bell icon with unread badge ───────────────────────────────────────────────
function AlertBell({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative p-1.5 transition"
      style={{ borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}
      title={unread > 0 ? `${unread} unread alert${unread > 1 ? 's' : ''}` : 'No alerts'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--primary)' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

interface DashboardShellProps {
  user:     { id: string; email: string }
  children: React.ReactNode
}

// ── Navigation structure ──────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '',
    subTabs: [
      { id: 'dashboard-home', label: 'Home' },
    ],
  },
  {
    id: 'action',
    label: 'Intelligence',
    icon: '◉',
    subTabs: [
      { id: 'action', label: 'When to Act' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: '◇',
    subTabs: [
      { id: 'overview',   label: 'Overview' },
      { id: 'positions',  label: 'Positions' },
      { id: 'sizing',     label: 'Sizing' },
      { id: 'catalysts',  label: 'Catalysts' },
      { id: 'hedge',      label: 'Hedge' },
      { id: 'options',    label: 'Options' },
      { id: 'watch-to-sell', label: 'Watch to Sell' },
      { id: 'premarket',  label: 'Pre/After Market' },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: '★',
    subTabs: [
      { id: 'pipeline-unified', label: 'Pipeline' },
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
      { id: 'win-rate',   label: 'Win Rate' },
      { id: 'claude-log', label: 'Claude Log' },
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
  const setUserId         = useDashboardStore((s) => s.setUserId)
  const activeGroup       = useDashboardStore((s) => s.activeGroup)
  const activeSubTab      = useDashboardStore((s) => s.activeSubTab)
  const setActiveGroup    = useDashboardStore((s) => s.setActiveGroup)
  const setActiveSubTab   = useDashboardStore((s) => s.setActiveSubTab)
  const isSyncing         = useDashboardStore((s) => s.isSyncing)
  const pricesLastFetched = useDashboardStore((s) => s.pricesLastFetched)
  const alerts            = useDashboardStore((s) => s.alerts)
  const markAlertRead     = useDashboardStore((s) => s.markAlertRead)
  const reset             = useDashboardStore((s) => s.reset)
  const killSwitchActive  = useDashboardStore((s) => s.killSwitchActive)
  const setKillSwitch     = useDashboardStore((s) => s.setKillSwitch)
  const paperModeActive   = useDashboardStore((s) => s.paperModeActive)
  const supabase = createClient()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const unreadCount = alerts.filter((a) => !a.readAt).length

  useEffect(() => {
    setUserId(user.id)
  }, [user.id, setUserId])

  // Close dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return
    function handleOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [bellOpen])

  function timeAgo(iso: string) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (sec < 60)        return `${sec}s ago`
    if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
  }

  function handleMarkAllRead() {
    alerts.filter((a) => !a.readAt).forEach((a) => markAlertRead(a.id))
  }

  async function handleSignOut() {
    reset()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const currentGroup = NAV_GROUPS.find((g) => g.id === activeGroup)
  const subTabs      = currentGroup?.subTabs ?? []
  const showSubNav   = subTabs.length > 1

  const latestAlerts = alerts.slice(0, 10)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        <div className="mx-auto max-w-screen-xl px-4">
          {/* Primary row */}
          <div className="flex items-center gap-2 py-2.5">
            {/* Logo */}
            <div className="flex flex-col items-center justify-center shrink-0 mr-2" style={{ width: 30, height: 30, border: '1.5px solid var(--primary)', borderRadius: 8 }}>
              <span className="text-xs font-bold leading-none" style={{ color: 'var(--primary)' }}>P3</span>
            </div>
            <div className="hidden sm:flex flex-col mr-3">
              <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>P3</span>
              <span className="text-[10px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>Portfolio Platform</span>
            </div>

            {/* Primary group nav */}
            <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none">
              {NAV_GROUPS.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-semibold transition shrink-0"
                  style={activeGroup === group.id ? {
                    background: 'rgba(255,255,255,0.10)',
                    color: '#FFFFFF',
                    borderBottom: '2px solid #378ADD',
                    borderRadius: '6px 6px 0 0',
                  } : {
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {group.icon && <span className="text-xs">{group.icon}</span>}
                  {group.label}
                </button>
              ))}
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <SyncStatus isSyncing={isSyncing} lastFetched={pricesLastFetched} />

              {/* Kill Switch */}
              <button
                onClick={() => setKillSwitch(!killSwitchActive)}
                title={killSwitchActive ? 'Kill Switch ON — click to deactivate' : 'Kill Switch OFF — click to activate'}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                style={killSwitchActive ? {
                  background: 'var(--danger-text)',
                  color: '#1A0A0A',
                  border: '0.5px solid var(--danger-text)',
                } : {
                  border: '0.5px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {killSwitchActive ? '⚡ KILL' : '⚡ Kill'}
              </button>

              {/* Bell with dropdown */}
              <div ref={bellRef} className="relative">
                <AlertBell
                  unread={unreadCount}
                  onClick={() => setBellOpen((o) => !o)}
                />
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl z-50" style={{ background: 'var(--surface)', border: '0.5px solid var(--border)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Alerts</span>
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs transition"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        Mark all read
                      </button>
                    </div>
                    {/* Alert list */}
                    <div className="max-h-80 overflow-y-auto">
                      {latestAlerts.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>No alerts yet</p>
                      ) : (
                        latestAlerts.map((alert) => (
                          <button
                            key={alert.id}
                            onClick={() => {
                              markAlertRead(alert.id)
                              setBellOpen(false)
                              setActiveGroup('portfolio', 'action')
                            }}
                            className={`w-full text-left flex items-start gap-3 px-4 py-3 transition ${!alert.readAt ? 'border-l-2' : ''}`}
                            style={{ borderBottom: '0.5px solid var(--border)', borderLeftColor: !alert.readAt ? 'var(--primary)' : undefined }}
                          >
                            {alert.ticker && (
                              <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                                {alert.ticker}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>{alert.message}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{timeAgo(alert.createdAt)}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme switcher */}
              <div className="hidden sm:inline-flex items-center" style={{ gap: 1, padding: 2, border: '0.5px solid var(--border)', borderRadius: 6 }}>
                {(['☀', '◐', '●'] as const).map((icon, i) => (
                  <button
                    key={icon}
                    title={['Light (coming soon)', 'Medium', 'OLED'][i]}
                    disabled={i !== 1}
                    style={{
                      width: 28, height: 28, border: 'none', cursor: i === 1 ? 'default' : 'not-allowed',
                      borderRadius: 4, fontSize: 13,
                      background: i === 1 ? 'var(--primary)' : 'transparent',
                      color: i === 1 ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              <span className="hidden text-xs sm:block max-w-[140px] truncate" style={{ color: 'var(--text-tertiary)' }}>{user.email}</span>
              <button
                onClick={handleSignOut}
                className="btn"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Secondary sub-tab row */}
          {showSubNav && (
            <div className="flex gap-0.5 overflow-x-auto scrollbar-none pt-1 pb-1" style={{ borderTop: '0.5px solid var(--border)' }}>
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className="whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition shrink-0"
                  style={activeSubTab === tab.id ? {
                    background: 'rgba(255,255,255,0.10)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    boxShadow: 'inset 0 -2px 0 #378ADD',
                  } : {
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Kill switch banner */}
      {killSwitchActive && (
        <div className="sticky top-[var(--header-h,56px)] z-20 flex items-center gap-3 border-b border-red-800 bg-red-950 px-4 py-2">
          <span className="text-red-400 font-bold text-sm">⚡ KILL SWITCH ACTIVE</span>
          <span className="text-red-300 text-xs">All execution reminders and order prompts are suppressed.</span>
          <button
            onClick={() => setKillSwitch(false)}
            className="ml-auto text-xs text-red-400 hover:text-red-200 transition"
          >
            Deactivate
          </button>
        </div>
      )}

      {/* Paper mode banner */}
      {paperModeActive && (
        <div className="sticky top-[var(--header-h,56px)] z-20 flex items-center gap-3 border-b border-amber-800 bg-amber-950 px-4 py-2">
          <span className="text-amber-400 font-bold text-sm">📄 PAPER MODE</span>
          <span className="text-amber-300 text-xs">Real money execution reminders are blocked.</span>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6" style={{ color: 'var(--text-primary)' }}>
        {children}
      </main>

      {/* Ticker detail modal */}
      <TickerModal />
    </div>
  )
}
