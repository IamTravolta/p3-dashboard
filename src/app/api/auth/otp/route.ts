/**
 * POST /api/auth/otp
 *
 * Sends a login code to whatever identifier the user typed:
 *
 * • Primary email   → Supabase signInWithOtp (Supabase handles sending)
 * • Linked email    → custom 6-digit code sent via Resend to that email
 * • Registered phone → custom 6-digit code sent via Twilio SMS
 *
 * Returns { flow: 'supabase'|'custom', sentTo: string, channel: 'email'|'sms' }
 */
import { NextRequest, NextResponse }              from 'next/server'
import { createClient as createServerClient }     from '@/lib/supabase/server'
import { createClient }                           from '@supabase/supabase-js'
import { sendEmail, otpEmailHtml }                from '@/lib/utils/resend'
import { sendSms, otpSmsBody }                    from '@/lib/utils/twilio'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isPhone(input: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(input) && input.includes('+')
}

async function issueCustomOtp(
  primaryUserId: string,
  recipient: string,
  channel: 'email' | 'sms',
): Promise<{ ok: boolean; error?: string }> {
  const code      = generateCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // Clear previous unused challenges for this recipient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('otp_challenges')
    .delete()
    .eq(channel === 'sms' ? 'phone' : 'email', recipient)
    .is('used_at', null)

  const row = channel === 'sms'
    ? { phone: recipient, primary_user_id: primaryUserId, code, expires_at: expiresAt, channel }
    : { email: recipient, primary_user_id: primaryUserId, code, expires_at: expiresAt, channel }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabaseAdmin as any)
    .from('otp_challenges')
    .insert(row)

  if (insertErr) return { ok: false, error: 'Failed to create challenge' }

  if (channel === 'sms') {
    return sendSms({ to: recipient, body: otpSmsBody(code) })
  } else {
    return sendEmail({ to: recipient, subject: 'Your P3 login code', html: otpEmailHtml(code) })
  }
}

export async function POST(req: NextRequest) {
  const { identifier } = await req.json()
  if (!identifier || typeof identifier !== 'string') {
    return NextResponse.json({ error: 'identifier is required' }, { status: 400 })
  }

  const input = identifier.trim()

  // ── SMS path — registered phone number ────────────────────────────────────
  if (isPhone(input)) {
    const normalised = input.replace(/\s+/g, '')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: phoneRow } = await (supabaseAdmin as any)
      .from('user_phones')
      .select('user_id')
      .eq('phone', normalised)
      .maybeSingle()

    if (!phoneRow) {
      return NextResponse.json(
        { error: 'That number is not registered. Add it in Settings first.' },
        { status: 400 },
      )
    }

    const { ok, error } = await issueCustomOtp(phoneRow.user_id, normalised, 'sms')
    if (!ok) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ flow: 'custom', sentTo: normalised, channel: 'sms' })
  }

  // ── Email paths ───────────────────────────────────────────────────────────
  const normalised = input.toLowerCase()

  // Check if it's a linked (secondary) email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkedRow } = await (supabaseAdmin as any)
    .from('user_linked_emails')
    .select('user_id')
    .eq('email', normalised)
    .maybeSingle()

  if (linkedRow) {
    const { ok, error } = await issueCustomOtp(linkedRow.user_id, normalised, 'email')
    if (!ok) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ flow: 'custom', sentTo: normalised, channel: 'email' })
  }

  // Primary email — let Supabase handle it
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email:   normalised,
    options: { shouldCreateUser: false },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ flow: 'supabase', sentTo: normalised, channel: 'email' })
}
