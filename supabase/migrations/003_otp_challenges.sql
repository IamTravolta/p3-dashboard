-- Migration: otp_challenges
-- Stores short-lived OTP codes for custom email login flow.
-- Used when a linked (secondary) email is entered at login —
-- we generate our own code and send it via Resend so it arrives
-- at the email the user actually typed.

create table if not exists otp_challenges (
  id             uuid        default gen_random_uuid() primary key,
  email          text        not null,
  primary_user_id uuid       not null references auth.users(id) on delete cascade,
  code           text        not null,   -- 6-digit code (plain — TTL is 5min)
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz default now() not null
);

-- Index for fast lookup during verify
create index otp_challenges_email_idx on otp_challenges (email, expires_at);

-- Auto-clean expired rows (optional helper)
create or replace function cleanup_expired_otp_challenges()
returns void language sql security definer as $$
  delete from otp_challenges where expires_at < now() - interval '1 hour';
$$;
