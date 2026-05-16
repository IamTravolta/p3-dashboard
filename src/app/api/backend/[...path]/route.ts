/**
 * Catch-all proxy to the Railway backend.
 *
 * All requests to /api/backend/** are forwarded to:
 *   BACKEND_URL/<path>
 *
 * This keeps the Railway URL server-side only and avoids CORS in the browser.
 *
 * Examples:
 *   POST /api/backend/analyze     → BACKEND_URL/analyze
 *   POST /api/backend/verdict     → BACKEND_URL/verdict
 *   POST /api/backend/briefing    → BACKEND_URL/briefing
 *   GET  /api/backend/ta/AAPL     → BACKEND_URL/ta/AAPL
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy('GET', request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy('POST', request, await params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy('PUT', request, await params)
}

// ── Core proxy function ───────────────────────────────────────────────────────

async function proxy(
  method: string,
  request: NextRequest,
  params: { path: string[] }
) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL not configured. Add it to .env.local.' },
      { status: 503 }
    )
  }

  const path     = params.path.join('/')
  const search   = new URL(request.url).search
  const targetUrl = `${BACKEND_URL.replace(/\/$/, '')}/${path}${search}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Pass user context to backend so it can associate data
    'X-User-Id':    user.id,
    'X-User-Email': user.email ?? '',
  }

  let body: string | undefined
  if (method === 'POST' || method === 'PUT') {
    try {
      const json = await request.json()
      body = JSON.stringify(json)
    } catch {
      body = undefined
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),   // 30-second timeout
    })

    const contentType = upstream.headers.get('content-type') ?? ''
    const text = await upstream.text()

    // Try to parse as JSON, fall back to plain text
    let responseBody: unknown
    if (contentType.includes('application/json')) {
      try { responseBody = JSON.parse(text) }
      catch { responseBody = { raw: text } }
    } else {
      responseBody = { raw: text }
    }

    return NextResponse.json(responseBody, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Backend unreachable'
    console.error(`[backend-proxy] ${method} ${targetUrl}:`, msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
