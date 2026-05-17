import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/lib/types/database'

type WatchlistUpdate = Database['public']['Tables']['watchlist']['Update']
type WatchlistRow    = Database['public']['Tables']['watchlist']['Row']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { id } = await params
  const body    = await request.json() as WatchlistUpdate

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('watchlist')
    .update(body)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single() as { data: WatchlistRow | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' },  { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from('watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) as { error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
