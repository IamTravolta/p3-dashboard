import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/lib/types/database'

type PositionUpdate = Database['public']['Tables']['positions']['Update']
type PositionRow    = Database['public']['Tables']['positions']['Row']

// ── PATCH — update position ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { id } = await params
  const body    = await request.json() as PositionUpdate

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('positions')
    .update(body)
    .eq('id', id)
    .eq('user_id', userId)   // RLS double-check
    .select()
    .single() as { data: PositionRow | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' },  { status: 404 })

  // Non-blocking conviction snapshot — log but don't fail the request
  ;(async () => {
    try {
      const updatedPosition = data
      await (db as any).from('conviction_snapshots').insert({
        user_id:       userId,
        ticker:        updatedPosition.ticker,
        score:         updatedPosition.conviction ?? null,
        factor_scores: updatedPosition.factor_scores ?? null,
        logged_at:     new Date().toISOString(),
      })
    } catch (snapErr) {
      console.error('[positions PATCH] conviction_snapshots insert failed:', snapErr)
    }
  })()

  return NextResponse.json({ data })
}

// ── DELETE — remove position ─────────────────────────────────────────────────

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
    .from('positions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) as { error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
