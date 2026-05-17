-- Migration: SMS support for OTP challenges + user_phones table

-- Extend otp_challenges to support both email and SMS channels
alter table otp_challenges
  add column if not exists channel text not null default 'email'
    check (channel in ('email', 'sms')),
  add column if not exists phone text,
  alter column email drop not null;

-- Phone numbers a user can log in with (receives SMS OTP)
create table if not exists user_phones (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  phone      text        not null,
  label      text,
  created_at timestamptz default now() not null,
  unique (user_id, phone)
);

alter table user_phones enable row level security;

create policy "owner_select" on user_phones
  for select using (auth.uid() = user_id);

create policy "owner_insert" on user_phones
  for insert with check (auth.uid() = user_id);

create policy "owner_delete" on user_phones
  for delete using (auth.uid() = user_id);
