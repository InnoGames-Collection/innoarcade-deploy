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
  coins      bigint not null default 0,
  created_at timestamptz not null default now()
);

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
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', 'Player'))
  on conflict (id) do nothing;
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
