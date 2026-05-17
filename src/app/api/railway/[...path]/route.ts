/**
 * Transparent auth-gated proxy to the Railway backend.
 *
 * All Railway API calls go through here so credentials stay server-side
 * and every request is authenticated against Supabase.
 *
 * Usage (client-side):
 *   fetch('/api/railway/insider-flow?tickers=AAPL,MSFT')
 *   fetch('/api/railway/council/synthesize', { method: 'POST', body: JSON.stringify({...}) })
 *
 * Set RAILWAY_BACKEND_URL in .env.local:
 *   RAILWAY_BACKEND_URL=https://your-project.up.railway.app
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RAILWAY_URL = process.env.RAILWAY_BACKEND_URL ?? ''

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RAILWAY_URL) {
    return NextResponse.json(
      { error: 'RAILWAY_BACKEND_URL not configured' },
      { status: 503 }
    )
  }

  const { path } = await params
  const pathStr   = path.join('/')
  const search    = req.nextUrl.search ?? ''
  const targetUrl = `${RAILWAY_URL}/api/${pathStr}${search}`

  // Forward the request
  const init: RequestInit = {
    method:  req.method,
    headers: { 'Content-Type': 'application/json' },
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      init.body = await req.text()
    } catch {
      // no body
    }
  }

  try {
    const upstream = await fetch(targetUrl, init)
    const body     = await upstream.text()

    return new NextResponse(body, {
      status:  upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[railway-proxy] fetch error:', err)
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const DELETE = handler
export const PATCH  = handler
