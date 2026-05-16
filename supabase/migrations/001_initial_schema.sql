-- ============================================================
-- P3 Dashboard — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. POSITIONS
-- ============================================================
create table if not exists public.positions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  name          text not null,
  exchange      text not null,
  sector        text not null,
  sub_industry  text,
  shares        numeric(18, 6) not null default 0,
  avg_buy_price numeric(18, 6) not null default 0,
  current_price numeric(18, 6) not null default 0,
  currency      text not null default 'USD',
  factor_scores jsonb not null default '{"q":0,"g":0,"v":0,"m":0,"s":0}'::jsonb,
  conviction    smallint not null default 3 check (conviction between 1 and 5),
  thesis        text,
  notes         text,
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists positions_user_id_idx on public.positions(user_id);
create unique index if not exists positions_user_ticker_idx on public.positions(user_id, ticker);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger positions_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.positions enable row level security;
create policy "Users can read their own positions"
  on public.positions for select using (auth.uid() = user_id);
create policy "Users can insert their own positions"
  on public.positions for insert with check (auth.uid() = user_id);
create policy "Users can update their own positions"
  on public.positions for update using (auth.uid() = user_id);
create policy "Users can delete their own positions"
  on public.positions for delete using (auth.uid() = user_id);

-- ============================================================
-- 2. WATCHLIST
-- ============================================================
create table if not exists public.watchlist (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  name          text not null,
  exchange      text not null,
  sector        text not null,
  sub_industry  text,
  current_price numeric(18, 6) not null default 0,
  score         numeric(5, 2) not null default 0,
  factor_scores jsonb not null default '{"q":0,"g":0,"v":0,"m":0,"s":0}'::jsonb,
  reason        text,
  price_trigger numeric(18, 6),
  score_trigger numeric(5, 2),
  conviction    smallint not null default 3 check (conviction between 1 and 5),
  expiry_date   date,
  added_at      timestamptz not null default now()
);

create index if not exists watchlist_user_id_idx on public.watchlist(user_id);
create unique index if not exists watchlist_user_ticker_idx on public.watchlist(user_id, ticker);

alter table public.watchlist enable row level security;
create policy "Users can read their own watchlist"
  on public.watchlist for select using (auth.uid() = user_id);
create policy "Users can insert their own watchlist"
  on public.watchlist for insert with check (auth.uid() = user_id);
create policy "Users can update their own watchlist"
  on public.watchlist for update using (auth.uid() = user_id);
create policy "Users can delete their own watchlist"
  on public.watchlist for delete using (auth.uid() = user_id);

-- ============================================================
-- 3. SIGNALS
-- ============================================================
create table if not exists public.signals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  module_name text not null,
  value       text not null,
  confidence  numeric(5, 4) not null check (confidence between 0 and 1),
  reasoning   text,
  raw_data    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists signals_user_id_idx on public.signals(user_id);
create index if not exists signals_ticker_idx on public.signals(user_id, ticker);
create index if not exists signals_created_at_idx on public.signals(created_at desc);

alter table public.signals enable row level security;
create policy "Users can read their own signals"
  on public.signals for select using (auth.uid() = user_id);
create policy "Users can insert their own signals"
  on public.signals for insert with check (auth.uid() = user_id);

-- ============================================================
-- 4. VERDICTS
-- ============================================================
create table if not exists public.verdicts (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ticker           text not null,
  final_verdict    text not null,
  confidence       numeric(5, 4) not null check (confidence between 0 and 1),
  modules_snapshot jsonb not null default '{}'::jsonb,
  initial_price    numeric(18, 6) not null,
  logged_at        timestamptz not null default now()
);

create index if not exists verdicts_user_id_idx on public.verdicts(user_id);
create index if not exists verdicts_ticker_idx on public.verdicts(user_id, ticker);
create index if not exists verdicts_logged_at_idx on public.verdicts(logged_at desc);

alter table public.verdicts enable row level security;
create policy "Users can read their own verdicts"
  on public.verdicts for select using (auth.uid() = user_id);
create policy "Users can insert their own verdicts"
  on public.verdicts for insert with check (auth.uid() = user_id);

-- ============================================================
-- 5. VERDICT OUTCOMES
-- ============================================================
create table if not exists public.verdict_outcomes (
  id              uuid primary key default uuid_generate_v4(),
  verdict_id      uuid not null references public.verdicts(id) on delete cascade,
  days_since      smallint not null check (days_since in (30, 60, 90)),
  price_then      numeric(18, 6) not null,
  price_change_pct numeric(8, 4) not null,
  outcome         text not null check (outcome in ('correct', 'wrong', 'neutral', 'missed_gain')),
  evaluated_at    timestamptz not null default now()
);

create index if not exists verdict_outcomes_verdict_idx on public.verdict_outcomes(verdict_id);
create unique index if not exists verdict_outcomes_unique on public.verdict_outcomes(verdict_id, days_since);

alter table public.verdict_outcomes enable row level security;
-- Access verdict_outcomes via verdict ownership
create policy "Users can read their own verdict outcomes"
  on public.verdict_outcomes for select
  using (
    exists (
      select 1 from public.verdicts v
      where v.id = verdict_id and v.user_id = auth.uid()
    )
  );
create policy "Users can insert verdict outcomes"
  on public.verdict_outcomes for insert
  with check (
    exists (
      select 1 from public.verdicts v
      where v.id = verdict_id and v.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. CONVICTION SNAPSHOTS
-- ============================================================
create table if not exists public.conviction_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  score         numeric(5, 2) not null,
  factor_scores jsonb not null default '{}'::jsonb,
  logged_at     timestamptz not null default now()
);

create index if not exists conviction_snapshots_user_idx on public.conviction_snapshots(user_id);
create index if not exists conviction_snapshots_ticker_idx on public.conviction_snapshots(user_id, ticker);
create index if not exists conviction_snapshots_logged_at_idx on public.conviction_snapshots(logged_at desc);

alter table public.conviction_snapshots enable row level security;
create policy "Users can read their own conviction snapshots"
  on public.conviction_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert their own conviction snapshots"
  on public.conviction_snapshots for insert with check (auth.uid() = user_id);

-- ============================================================
-- 7. BEHAVIORAL LOG
-- ============================================================
create table if not exists public.behavioral_log (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  action_type           text not null,
  ticker                text,
  system_recommendation text,
  user_action           text not null,
  followed_advice       boolean,
  context               jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists behavioral_log_user_id_idx on public.behavioral_log(user_id);
create index if not exists behavioral_log_created_at_idx on public.behavioral_log(created_at desc);
create index if not exists behavioral_log_action_type_idx on public.behavioral_log(user_id, action_type);

alter table public.behavioral_log enable row level security;
create policy "Users can read their own behavioral log"
  on public.behavioral_log for select using (auth.uid() = user_id);
create policy "Users can insert into behavioral log"
  on public.behavioral_log for insert with check (auth.uid() = user_id);

-- ============================================================
-- 8. SIGNAL RELIABILITY
-- ============================================================
create table if not exists public.signal_reliability (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  module_signal_key text not null,   -- e.g. "polymarket:BEARISH"
  total             integer not null default 0,
  correct_30d       integer not null default 0,
  correct_60d       integer not null default 0,
  correct_90d       integer not null default 0,
  wrong_30d         integer not null default 0,
  accuracy_30d      numeric(5, 4),   -- computed: correct_30d / total
  last_updated      timestamptz not null default now()
);

create unique index if not exists signal_reliability_user_key_idx
  on public.signal_reliability(user_id, module_signal_key);

alter table public.signal_reliability enable row level security;
create policy "Users can read their own signal reliability"
  on public.signal_reliability for select using (auth.uid() = user_id);
create policy "Users can upsert signal reliability"
  on public.signal_reliability for insert with check (auth.uid() = user_id);
create policy "Users can update signal reliability"
  on public.signal_reliability for update using (auth.uid() = user_id);

-- ============================================================
-- 9. BRIEFINGS
-- ============================================================
create table if not exists public.briefings (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  content      text not null,
  context_hash text,   -- SHA of the snapshot used — skip regeneration if unchanged
  created_at   timestamptz not null default now()
);

create index if not exists briefings_user_id_idx on public.briefings(user_id);
create index if not exists briefings_created_at_idx on public.briefings(created_at desc);

alter table public.briefings enable row level security;
create policy "Users can read their own briefings"
  on public.briefings for select using (auth.uid() = user_id);
create policy "Users can insert their own briefings"
  on public.briefings for insert with check (auth.uid() = user_id);

-- ============================================================
-- 10. NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,
  ticker       text,
  message      text not null,
  triggered_at timestamptz not null default now(),
  sent_at      timestamptz,
  read_at      timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_unread_idx on public.notifications(user_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;
create policy "Users can read their own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "Users can insert their own notifications"
  on public.notifications for insert with check (auth.uid() = user_id);
create policy "Users can update their own notifications"
  on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- 11. VOLUME SNAPSHOTS
-- ============================================================
create table if not exists public.volume_snapshots (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ticker           text not null,
  volume           bigint not null,
  avg_volume_20d   bigint,
  relative_volume  numeric(8, 4),   -- volume / avg_volume_20d
  price            numeric(18, 6) not null,
  direction        text not null check (direction in ('up', 'down', 'flat')),
  created_at       timestamptz not null default now()
);

create index if not exists volume_snapshots_user_id_idx on public.volume_snapshots(user_id);
create index if not exists volume_snapshots_ticker_idx on public.volume_snapshots(user_id, ticker);
create index if not exists volume_snapshots_created_at_idx on public.volume_snapshots(created_at desc);

alter table public.volume_snapshots enable row level security;
create policy "Users can read their own volume snapshots"
  on public.volume_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert their own volume snapshots"
  on public.volume_snapshots for insert with check (auth.uid() = user_id);

-- ============================================================
-- 12. SPECULATION SCORES
-- ============================================================
create table if not exists public.speculation_scores (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ticker           text not null,
  speculation_score numeric(5, 2) not null check (speculation_score between 0 and 100),
  beta             numeric(6, 4),
  momentum_score   numeric(5, 2),
  valuation_score  numeric(5, 2),
  iv_rank          numeric(5, 2),
  logged_at        timestamptz not null default now()
);

create index if not exists speculation_scores_user_id_idx on public.speculation_scores(user_id);
create index if not exists speculation_scores_ticker_idx on public.speculation_scores(user_id, ticker);

alter table public.speculation_scores enable row level security;
create policy "Users can read their own speculation scores"
  on public.speculation_scores for select using (auth.uid() = user_id);
create policy "Users can insert their own speculation scores"
  on public.speculation_scores for insert with check (auth.uid() = user_id);

-- ============================================================
-- 13. PAPER TRADES
-- ============================================================
create table if not exists public.paper_trades (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ticker           text not null,
  name             text not null,
  action           text not null check (action in ('BUY', 'SELL', 'TRIM')),
  shares           numeric(18, 6) not null,
  entry_price      numeric(18, 6) not null,
  entry_date       date not null,
  entry_timestamp  bigint not null,
  stop_loss        numeric(18, 6),
  target_1         numeric(18, 6),
  target_2         numeric(18, 6),
  verdict_snapshot jsonb,
  evaluations      jsonb not null default '[]'::jsonb,
  status           text not null default 'open' check (status in ('open', 'closed')),
  closed_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists paper_trades_user_id_idx on public.paper_trades(user_id);
create index if not exists paper_trades_status_idx on public.paper_trades(user_id, status);

alter table public.paper_trades enable row level security;
create policy "Users can read their own paper trades"
  on public.paper_trades for select using (auth.uid() = user_id);
create policy "Users can insert their own paper trades"
  on public.paper_trades for insert with check (auth.uid() = user_id);
create policy "Users can update their own paper trades"
  on public.paper_trades for update using (auth.uid() = user_id);
create policy "Users can delete their own paper trades"
  on public.paper_trades for delete using (auth.uid() = user_id);

-- ============================================================
-- 14. THESIS LOG
-- ============================================================
create table if not exists public.thesis_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  thesis_text text not null,
  conviction  smallint not null default 3 check (conviction between 1 and 5),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists thesis_log_user_id_idx on public.thesis_log(user_id);
create index if not exists thesis_log_ticker_idx on public.thesis_log(user_id, ticker);
create index if not exists thesis_log_created_at_idx on public.thesis_log(created_at desc);

alter table public.thesis_log enable row level security;
create policy "Users can read their own thesis log"
  on public.thesis_log for select using (auth.uid() = user_id);
create policy "Users can insert their own thesis log"
  on public.thesis_log for insert with check (auth.uid() = user_id);
create policy "Users can update their own thesis log"
  on public.thesis_log for update using (auth.uid() = user_id);
