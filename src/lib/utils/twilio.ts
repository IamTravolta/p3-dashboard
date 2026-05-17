/**
 * Thin Twilio SMS wrapper — raw REST, no SDK dependency.
 */

export async function sendSms({
  to,
  body,
}: {
  to: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    console.error('[twilio] missing env vars')
    return { ok: false, error: 'SMS service not configured' }
  }

  const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    },
  )

  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    console.error('[twilio] send failed', j)
    return { ok: false, error: (j as { message?: string }).message ?? 'SMS send failed' }
  }

  return { ok: true }
}

export function otpSmsBody(code: string): string {
  return `Your P3 Dashboard login code: ${code}\nExpires in 5 minutes.`
}
