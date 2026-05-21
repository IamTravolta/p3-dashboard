import { NextRequest, NextResponse } from 'next/server'
import { requireUser, supabaseAdmin } from '@/lib/auth'

const ENV_RAILWAY_URL = process.env.RAILWAY_BACKEND_URL ?? ''

async function getRailwayUrl(userId: string): Promise<string> {
  if (ENV_RAILWAY_URL) return ENV_RAILWAY_URL.replace(/\/$/, '')

  // Fall back to URL saved in user settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('users')
    .select('raw_user_meta_data')
    .eq('id', userId)
    .single()
    .catch(() => ({ data: null }))

  const saved = data?.raw_user_meta_data?.settings?.railwayUrl as string | undefined
  return saved ? saved.replace(/\/$/, '') : ''
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId } = _auth

  const railwayUrl = await getRailwayUrl(userId)

  if (!railwayUrl) {
    return NextResponse.json(
      { error: 'RAILWAY_BACKEND_URL not configured' },
      { status: 503 }
    )
  }

  const { path } = await params
  const pathStr   = path.join('/')
  const search    = req.nextUrl.search ?? ''
  const targetUrl = `${railwayUrl}/api/${pathStr}${search}`

  const init: RequestInit = {
    method:  req.method,
    headers: { 'Content-Type': 'application/json' },
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { init.body = await req.text() } catch { /* no body */ }
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
