/**
 * railwayFetch — drop-in replacement for fetch('/api/railway/...')
 *
 * Reads the Railway URL from the Zustand store and injects it as the
 * `x-railway-url` header so the server-side proxy can forward directly
 * without a Supabase user_metadata round-trip.
 */
import { useDashboardStore } from '@/lib/store'

export function railwayFetch(path: string, init?: RequestInit): Promise<Response> {
  const railwayUrl = useDashboardStore.getState().railwayUrl
  const existing   = (init?.headers ?? {}) as Record<string, string>
  const headers: Record<string, string> = {
    ...existing,
    ...(railwayUrl ? { 'x-railway-url': railwayUrl } : {}),
  }
  return fetch(path, { ...init, headers })
}
