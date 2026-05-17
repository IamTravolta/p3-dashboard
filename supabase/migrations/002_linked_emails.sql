-- Migration: user_linked_emails
-- Stores additional email addresses a user can use to log in.
-- On the login screen, entering any linked email routes the OTP
-- to the primary Supabase auth email so Supabase can verify it.

create table if not exists user_linked_emails (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  email      text        not null,
  label      text,
  created_at timestamptz default now() not null,
  unique (user_id, email)
);

alter table user_linked_emails enable row level security;

-- Users can only see and manage their own linked emails
create policy "owner_select" on user_linked_emails
  for select using (auth.uid() = user_id);

create policy "owner_insert" on user_linked_emails
  for insert with check (auth.uid() = user_id);

create policy "owner_delete" on user_linked_emails
  for delete using (auth.uid() = user_id);
