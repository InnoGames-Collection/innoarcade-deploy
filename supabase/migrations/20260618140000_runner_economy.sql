-- Ethiopian Runner (temple-dash) — a clean, isolated, server-authoritative
-- economy + scoring + leaderboard, built from scratch per the proposed game
-- mechanics doc. It is fully self-contained (its own `runner_*` tables) and does
-- NOT touch the legacy shared economy used by the other games, so it can serve
-- as the reference implementation to roll out later.
--
-- Model (doc-aligned):
--   * XP        — earned by every run (server matrix), drives level + season rank.
--                 Lives in runner_xp; never client-writable.
--   * Coins     — the GLOBAL wallet (profiles.coins via apply_coins) — reused for
--                 the paid tournament entry. Coins are bought platform-wide.
--   * Score     — per-tournament RAW best (single Hard level, one board).
--   * Entry     — one fee buys N attempts; best score counts (doc §4).
--
-- Security: clients READ, only the runner-* Edge Functions (service role) WRITE.

-- ------------------------------------------------------------- runner_xp -----
-- Per-player XP: lifetime (only grows -> level) + season (resets at rollover).
create table if not exists public.runner_xp (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  xp         bigint not null default 0,
  xp_season  bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.runner_xp enable row level security;
drop policy if exists "runner_xp readable" on public.runner_xp;
create policy "runner_xp readable" on public.runner_xp for select using (true);

-- Atomic XP credit (service-role only). EARN only (delta >= 0); accrues season too.
create or replace function public.runner_apply_xp(p_user uuid, p_delta bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_xp bigint;
begin
  insert into public.runner_xp (user_id, xp, xp_season, updated_at)
    values (p_user, greatest(p_delta, 0), greatest(p_delta, 0), now())
  on conflict (user_id) do update set
    xp         = public.runner_xp.xp        + greatest(p_delta, 0),
    xp_season  = public.runner_xp.xp_season + greatest(p_delta, 0),
    updated_at = now()
  returning xp into new_xp;
  return new_xp;
end;
$$;

-- --------------------------------------------------------- runner_tournaments
-- A single live "Runner Championship" window (single Hard level, one board).
-- entry_fee_coins + attempts implement the doc's "one fee buys N attempts".
create table if not exists public.runner_tournaments (
  id              text primary key,
  title_en        text not null,
  title_am        text not null,
  entry_fee_coins bigint not null default 10,
  attempts        integer not null default 10,
  prize_pool_coins bigint not null default 0,
  prize_tiers     jsonb not null default '[{"rank":1,"pct":50},{"rank":2,"pct":30},{"rank":3,"pct":20}]'::jsonb,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  state           text not null default 'live' check (state in ('live','ended','settling','settled')),
  created_at      timestamptz not null default now()
);
alter table public.runner_tournaments enable row level security;
drop policy if exists "runner_tournaments readable" on public.runner_tournaments;
create policy "runner_tournaments readable" on public.runner_tournaments for select using (true);
drop policy if exists "runner_tournaments admin write" on public.runner_tournaments;
create policy "runner_tournaments admin write" on public.runner_tournaments
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------- runner_entries --
-- One row per (player, tournament): how many attempts were bought vs used, and
-- the total fees paid. The score gate consumes one attempt per ranked run.
create table if not exists public.runner_entries (
  user_id            uuid not null references auth.users (id) on delete cascade,
  tournament_id      text not null references public.runner_tournaments (id) on delete cascade,
  attempts_purchased integer not null default 0,
  attempts_used      integer not null default 0,
  fee_paid           bigint not null default 0,
  entered_at         timestamptz not null default now(),
  primary key (user_id, tournament_id)
);
alter table public.runner_entries enable row level security;
drop policy if exists "runner_entries own read" on public.runner_entries;
create policy "runner_entries own read" on public.runner_entries
  for select using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------ runner_scores --
-- Best raw score per (player, tournament). PUBLIC read (the ladder); only the
-- runner-submit Edge Function writes (service role).
create table if not exists public.runner_scores (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id text not null references public.runner_tournaments (id) on delete cascade,
  best          bigint not null default 0,
  plays         integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, tournament_id)
);
create index if not exists runner_scores_board_idx on public.runner_scores (tournament_id, best desc);
alter table public.runner_scores enable row level security;
drop policy if exists "runner_scores readable" on public.runner_scores;
create policy "runner_scores readable" on public.runner_scores for select using (true);

-- ------------------------------------------------------- leaderboard views ---
-- Tournament board: rank by raw best. security_invoker keeps runner_scores RLS
-- (public-read) in force for the anon API.
create or replace view public.runner_leaderboard
with (security_invoker = on) as
select
  s.tournament_id,
  s.user_id,
  coalesce(p.name, 'Player') as name,
  s.best                     as score,
  rank() over (partition by s.tournament_id order by s.best desc) as rank
from public.runner_scores s
left join public.profiles p on p.id = s.user_id;
grant select on public.runner_leaderboard to anon, authenticated;

-- Season board: rank by season XP.
create or replace view public.runner_season_leaderboard
with (security_invoker = on) as
select
  x.user_id,
  coalesce(p.name, 'Player') as name,
  x.xp_season,
  x.xp,
  rank() over (order by x.xp_season desc, x.user_id) as rank
from public.runner_xp x
left join public.profiles p on p.id = x.user_id;
grant select on public.runner_season_leaderboard to anon, authenticated;

-- ----------------------------------------------------- ensure_runner_tournament
-- Make sure a live monthly Runner Championship exists for the current month,
-- rolling the window over automatically. PRESERVES operator edits to an existing
-- row (fee/attempts/prize/titles).
create or replace function public.ensure_runner_tournament()
returns text language plpgsql security definer set search_path = public as $$
declare
  tid text := 'runner-' || to_char(now(), 'YYYY-MM');
  m_start timestamptz := date_trunc('month', now());
  m_end   timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  insert into public.runner_tournaments
    (id, title_en, title_am, entry_fee_coins, attempts, starts_at, ends_at, state)
  values
    (tid, 'Runner Championship', 'የሯጭ ሻምፒዮና', 10, 10, m_start, m_end, 'live')
  on conflict (id) do update set
    starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    state = case when public.runner_tournaments.state = 'settled' then 'settled' else 'live' end;
  return tid;
end;
$$;

-- The id of the currently-live Runner tournament (or null).
create or replace function public.active_runner_tournament()
returns text language sql stable security definer set search_path = public as $$
  select id from public.runner_tournaments
   where state = 'live' and now() >= starts_at and now() < ends_at
   order by ends_at asc limit 1;
$$;

-- ------------------------------------------------- settle_due_runner_tournaments
-- Pay out any Runner tournament whose window has closed: split the (sponsored)
-- prize pool by tiers to the top finishers, reset season XP for the new month,
-- and open the next window. Idempotent (state fence). Returns count settled.
create or replace function public.settle_due_runner_tournaments()
returns int language plpgsql security definer set search_path = public as $$
declare
  tour record; tier record; winner record; n int := 0; coins bigint;
begin
  for tour in
    select * from public.runner_tournaments where state in ('live','ended','settling') and ends_at <= now()
  loop
    update public.runner_tournaments set state = 'settling' where id = tour.id and state <> 'settled';

    for tier in select * from jsonb_to_recordset(tour.prize_tiers) as t(rank int, pct int) loop
      select s.user_id, s.best,
             rank() over (order by s.best desc) as rnk
        into winner
        from public.runner_scores s
       where s.tournament_id = tour.id
       order by s.best desc
       offset (tier.rank - 1) limit 1;
      if winner.user_id is null then continue; end if;
      coins := round(tour.prize_pool_coins * tier.pct / 100.0);
      if coins > 0 then
        perform public.apply_coins(winner.user_id, coins, 'runner_prize', tour.id);
      end if;
    end loop;

    update public.runner_tournaments set state = 'settled' where id = tour.id;
    -- New month: reset season XP and open the next window.
    update public.runner_xp set xp_season = 0 where xp_season <> 0;
    perform public.ensure_runner_tournament();
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Lock the SECURITY DEFINER functions to the service role (same posture as the
-- rest of the economy: clients never call these directly).
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.runner_apply_xp(uuid, bigint)',
    'public.ensure_runner_tournament()',
    'public.active_runner_tournament()',
    'public.settle_due_runner_tournaments()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- Open the first window now so the game has a live tournament immediately.
select public.ensure_runner_tournament();
