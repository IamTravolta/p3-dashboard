/**
 * Thin Resend API wrapper — no SDK, just a fetch call.
 * Set RESEND_API_KEY in your environment.
 * From address: configure RESEND_FROM in env (defaults to onboarding@resend.dev for testing).
 */

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[resend] RESEND_API_KEY is not set')
    return { ok: false, error: 'Email service not configured' }
  }

  const from = process.env.RESEND_FROM ?? 'P3 Dashboard <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error('[resend] send failed', body)
    return { ok: false, error: (body as { message?: string }).message ?? 'Send failed' }
  }

  return { ok: true }
}

export function otpEmailHtml(code: string): string {
  return `
    <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px;background:#09090b;border-radius:12px;border:1px solid #27272a">
      <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px">P3 Dashboard</h1>
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 24px">Your one-time login code</p>
      <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
        <span style="font-size:36px;font-weight:700;color:#fff;letter-spacing:12px;font-family:monospace">${code}</span>
      </div>
      <p style="color:#71717a;font-size:12px;margin:0">Expires in 5 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `
}
