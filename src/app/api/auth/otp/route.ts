/**
 * POST /api/auth/otp
 *
 * Sends a login code to the provided email — works for any registered email:
 *
 * • Primary email  → Supabase signInWithOtp (Supabase handles sending)
 * • Linked email   → custom 6-digit code generated here, sent via Resend
 *                    to the exact email the user typed, so they get it there.
 *
 * Returns:
 *   { flow: 'supabase', sentTo: string }   — primary email path
 *   { flow: 'custom',   sentTo: string }   — linked email path
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient }                        from '@supabase/supabase-js'
import { sendEmail, otpEmailHtml }             from '@/lib/utils/resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const normalised = email.toLowerCase().trim()

  // ── Check if this is a linked (secondary) email ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkedRow } = await (supabaseAdmin as any)
    .from('user_linked_emails')
    .select('user_id')
    .eq('email', normalised)
    .maybeSingle()

  // ── Primary email path ────────────────────────────────────────────────────
  if (!linkedRow) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.signInWithOtp({
      email:   normalised,
      options: { shouldCreateUser: false },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ flow: 'supabase', sentTo: normalised })
  }

  // ── Linked email path — send custom OTP via Resend ────────────────────────
  const primaryUserId = linkedRow.user_id

  // Resolve the primary email (needed later for session generation after verify)
  const { data: { user: primaryUser }, error: adminErr } =
    await supabaseAdmin.auth.admin.getUserById(primaryUserId)

  if (adminErr || !primaryUser?.email) {
    return NextResponse.json({ error: 'Could not resolve account' }, { status: 400 })
  }

  const code      = generateCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // Store the challenge (invalidate previous unused ones for this email first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('otp_challenges')
    .delete()
    .eq('email', normalised)
    .is('used_at', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabaseAdmin as any)
    .from('otp_challenges')
    .insert({
      email:           normalised,
      primary_user_id: primaryUserId,
      code,
      expires_at:      expiresAt,
    })

  if (insertErr) {
    console.error('[otp] insert error', insertErr)
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
  }

  // Send via Resend
  const { ok, error: sendErr } = await sendEmail({
    to:      normalised,
    subject: 'Your P3 login code',
    html:    otpEmailHtml(code),
  })

  if (!ok) {
    return NextResponse.json({ error: sendErr ?? 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ flow: 'custom', sentTo: normalised })
}
