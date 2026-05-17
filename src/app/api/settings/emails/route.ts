/**
 * GET  /api/settings/emails  — list linked emails for current user
 * POST /api/settings/emails  — add a new linked email
 */
import { NextRequest, NextResponse }    from 'next/server'
import { requireUser, supabaseAdmin }   from '@/lib/auth'

export async function GET() {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  // Resolve primary email from Supabase auth user
  const { data: { user: supaUser } } = await supabaseAdmin.auth.admin.getUserById(userId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('user_linked_emails')
    .select('id, email, label, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    primary: supaUser?.email ?? null,
    linked:  data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { email, label } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const normalised = email.toLowerCase().trim()

  // Prevent adding the primary email as a linked email
  const { data: { user: supaUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (normalised === supaUser?.email?.toLowerCase()) {
    return NextResponse.json({ error: 'That is already your primary login email' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('user_linked_emails')
    .insert({ user_id: userId, email: normalised, label: label?.trim() || null })
    .select('id, email, label, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That email is already in your list' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ linked: data })
}
