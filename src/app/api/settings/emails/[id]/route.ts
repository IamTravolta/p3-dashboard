/**
 * DELETE /api/settings/emails/[id]  — remove a linked email
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from('user_linked_emails')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)   // RLS + explicit guard

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
