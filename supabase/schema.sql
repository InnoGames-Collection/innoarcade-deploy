-- InnoArcade — database schema, Row-Level Security and the leaderboard view.
-- Apply this in the Supabase dashboard: SQL Editor → paste → Run.
--
-- Security model:
--   * profiles  — one row per player; names are public (shown on leaderboards),
--                 each user edits only their own row.
--   * scores    — best score per (player, tournament). PUBLIC to read, but NO
--                 client may write: only the `submit-score` Edge Function (which
--                 runs with the service role and validates first) inserts/updates.
--                 This is the anti-cheat boundary for prize tournaments.

-- ---------------------------------------------------------------- profiles ---
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Player',
  phone      text,
  coins      bigint not null default 0,
  created_at timestamptz not null default now()
);

-- (idempotent for projects created before phone was stored on the profile)
alter table public.profiles add column if not exists phone text;
-- Points: the play-earned currency (spent on draws/tickets). Server-authoritative
-- like coins — clients READ it, only the service-role functions move it.
alter table public.profiles add column if not exists points bigint not null default 0;

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.users.phone is stored without a leading '+'; keep profiles in E.164
  -- (with '+') so lookups/admin display are consistent.
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Player'),
    case
      when new.phone is null or new.phone = '' then null
      when left(new.phone, 1) = '+' then new.phone
      else '+' || new.phone
    end
  )
  on conflict (id) do update set phone = coalesce(public.profiles.phone, excluded.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ scores ---
create table if not exists public.scores (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id text not null,
  best          bigint not null default 0,
  plays         integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, tournament_id)
);

create index if not exists scores_board_idx
  on public.scores (tournament_id, best desc);

alter table public.scores enable row level security;

-- Anyone may READ scores (public ladder); nobody may write from the client.
-- The Edge Function uses the service role, which bypasses RLS.
drop policy if exists "scores are readable" on public.scores;
create policy "scores are readable" on public.scores
  for select using (true);

-- ------------------------------------------------------------- leaderboard ---
-- Ranked rows per tournament, joined to public names. security_invoker keeps the
-- underlying scores RLS in force when the anon API reads the view.
create or replace view public.leaderboard
with (security_invoker = on) as
select
  s.tournament_id,
  s.user_id,
  coalesce(p.name, 'Player') as name,
  s.best                     as score,
  rank() over (partition by s.tournament_id order by s.best desc) as rank
from public.scores s
left join public.profiles p on p.id = s.user_id;

grant select on public.leaderboard to anon, authenticated;

-- ============================================================================
-- Economy: roles, wallet ledger, payments, configurable tournaments & entries.
-- Same security model as scores: clients READ, only service-role Edge Functions
-- WRITE the money/state columns. Admin-only writes are gated by is_admin().
-- ============================================================================

-- Operator role on the profile (player | admin).
alter table public.profiles add column if not exists role text not null default 'player';

-- True when the caller is an admin. SECURITY DEFINER so it can read the role row
-- regardless of RLS; used by admin-only policies and the admin-action function.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Atomic coin movement: adjusts profiles.coins and appends a ledger row, never
-- letting a balance go negative. The ONLY way coins move — called from Edge
-- Functions (service role). Returns the new balance.
create or replace function public.apply_coins(
  p_user uuid, p_delta bigint, p_reason text, p_ref text default ''
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_bal bigint;
begin
  update public.profiles
     set coins = coins + p_delta
   where id = p_user and coins + p_delta >= 0
   returning coins into new_bal;
  if new_bal is null then
    raise exception 'insufficient_or_missing' using errcode = 'check_violation';
  end if;
  insert into public.wallet_ledger (user_id, delta, reason, ref, balance_after)
    values (p_user, p_delta, p_reason, p_ref, new_bal);
  return new_bal;
end;
$$;

-- Atomic points movement (play rewards credit; draw tickets debit). Never lets a
-- balance go negative. Service-role only, mirroring apply_coins. Returns new bal.
create or replace function public.apply_points(
  p_user uuid, p_delta bigint
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_bal bigint;
begin
  update public.profiles
     set points = points + p_delta
   where id = p_user and points + p_delta >= 0
   returning points into new_bal;
  if new_bal is null then
    raise exception 'insufficient_or_missing' using errcode = 'check_violation';
  end if;
  return new_bal;
end;
$$;

-- ------------------------------------------------------------ draw_entries ---
-- Server-authoritative draw ticket holdings. Tickets are bought by spending
-- points (apply_points) inside the enter-draw Edge Function; clients READ their
-- own rows, never write. Keyed per (player, draw window id).
create table if not exists public.draw_entries (
  user_id  uuid not null references auth.users (id) on delete cascade,
  draw_id  text not null,
  tickets  integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, draw_id)
);
alter table public.draw_entries enable row level security;
drop policy if exists "read own draw entries" on public.draw_entries;
create policy "read own draw entries" on public.draw_entries
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------ used_nonces ---
-- Anti-cheat: single-use round tokens. start-round issues a signed token; the
-- score gate records its jti here so a token cannot be replayed. Old rows are
-- harmless (the freshness window in submit-score rejects them anyway).
create table if not exists public.used_nonces (
  jti     text primary key,
  user_id uuid,
  used_at timestamptz not null default now()
);
alter table public.used_nonces enable row level security; -- service-role only; no client policies

-- ------------------------------------------------------------- app_config ---
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

drop policy if exists "config readable" on public.app_config;
create policy "config readable" on public.app_config for select using (true);

drop policy if exists "config admin write" on public.app_config;
create policy "config admin write" on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------- wallet_ledger ---
create table if not exists public.wallet_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  delta         bigint not null,
  reason        text not null,
  ref           text not null default '',
  balance_after bigint not null,
  created_at    timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
alter table public.wallet_ledger enable row level security;

-- Players read their own ledger; nobody writes from the client (apply_coins only).
drop policy if exists "ledger own read" on public.wallet_ledger;
create policy "ledger own read" on public.wallet_ledger
  for select using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------- payment_orders ---
create table if not exists public.payment_orders (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  package_id   text not null,
  method       text not null check (method in ('telebirr', 'topup')),
  amount_etb   numeric not null,
  coins        bigint not null,
  status       text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  provider_ref text,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);
create index if not exists orders_user_idx on public.payment_orders (user_id, created_at desc);
alter table public.payment_orders enable row level security;

drop policy if exists "orders own read" on public.payment_orders;
create policy "orders own read" on public.payment_orders
  for select using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------ tournaments ---
create table if not exists public.tournaments (
  id              text primary key,
  game_id         text not null,
  title_en        text not null,
  title_am        text not null,
  type            text not null default 'free' check (type in ('free', 'paid')),
  entry_fee_coins bigint not null default 0,
  prize_model     text not null default 'sponsored' check (prize_model in ('sponsored', 'pool')),
  sponsored_prize bigint not null default 0,
  prize_tiers     jsonb not null default '[{"rank":1,"pct":50},{"rank":2,"pct":30},{"rank":3,"pct":20}]'::jsonb,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  state           text not null default 'upcoming' check (state in ('upcoming','live','ended','settling','settled')),
  created_at      timestamptz not null default now()
);
alter table public.tournaments enable row level security;

drop policy if exists "tournaments readable" on public.tournaments;
create policy "tournaments readable" on public.tournaments for select using (true);

drop policy if exists "tournaments admin write" on public.tournaments;
create policy "tournaments admin write" on public.tournaments
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------ tournament_entries ---
create table if not exists public.tournament_entries (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id text not null,
  fee_paid      bigint not null default 0,
  prize_won     bigint not null default 0,
  entered_at    timestamptz not null default now(),
  primary key (user_id, tournament_id)
);
alter table public.tournament_entries enable row level security;

-- Players read their own entries; the entry/settlement Edge Functions write.
drop policy if exists "entries own read" on public.tournament_entries;
create policy "entries own read" on public.tournament_entries
  for select using (auth.uid() = user_id or public.is_admin());
