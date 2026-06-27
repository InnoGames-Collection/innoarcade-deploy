-- ============================================================================
-- Unify the two tournament systems into ONE (the generic `tournaments` system).
--
-- Absorbs the runner system's features into the generic tables so every game
-- competes the same way (Game Mechanics doc §4):
--   • per-game cadence (daily/weekly/monthly), ONE live window per game;
--   • pay-once → N attempts (daily 10c/3, weekly 30c/5, monthly 75c/10);
--   • best RP across attempts ranks (rp_for + game_stats, shared, unchanged);
--   • pooled prize = 65% of fees + per-cadence platform top-up;
--   • automatic settlement on a cron (the generic system had none before).
--
-- Tournament ids are DATE-SUFFIXED per window (e.g. temple-dash-daily-2026-06-27)
-- so each window keeps its own leaderboard + per-window best. Non-destructive:
-- only adds columns / replaces functions+views / (re)schedules cron.
-- ============================================================================

-- 1) Attempts model columns ---------------------------------------------------
alter table public.tournaments
  add column if not exists attempts integer not null default 1;
alter table public.tournament_entries
  add column if not exists attempts_purchased integer not null default 0,
  add column if not exists attempts_used      integer not null default 0;

-- 2) Resolve a game's single live tournament id (replaces the `-monthly`
--    hardcode the edge functions used). service_role only.
create or replace function public.active_game_tournament(p_game text)
returns text language sql stable security definer set search_path = public as $$
  select id from public.tournaments
   where game_id = p_game and state = 'live'
     and now() >= starts_at and now() < ends_at
   order by ends_at asc limit 1;
$$;

-- 3) End any pre-existing rows for the three relaunch games (old stable-id
--    monthly/weekly rows) so they can't collide with the new dated windows.
update public.tournaments
   set state = 'ended'
 where game_id in ('temple-dash', 'memory-match', 'fruit-slice')
   and state <> 'settled';

-- 4) seed_tournaments(): ONE dated window per relaunch game at its cadence.
--    Fee/attempts per doc §4.1. Re-runnable: rolls into the current window and
--    opens the next when a date boundary passes. Preserves operator edits
--    (fee/attempts/tiers untouched on conflict).
create or replace function public.seed_tournaments()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  tiers jsonb := '[{"rank":1,"pct":50},{"rank":2,"pct":25},{"rank":3,"pct":15}]'::jsonb;
  tid text; s timestamptz; e timestamptz;
begin
  for rec in
    select * from (values
      -- game,          cadence,   title_en,            title_am,      fee,        attempts
      ('temple-dash',  'daily',   'Daily Runner',       'ዕለታዊ ሩጫ',   10::bigint, 3),
      ('memory-match', 'weekly',  'Weekly Cup',         'ሳምንታዊ ዋንጫ', 30::bigint, 5),
      ('fruit-slice',  'monthly', 'Monthly Championship','ወርሃዊ ሻምፒዮና',75::bigint, 10)
    ) as v(game, cadence, title_en, title_am, fee, attempts)
  loop
    if rec.cadence = 'daily' then
      s := date_trunc('day', now());   e := s + interval '1 day';
      tid := rec.game || '-daily-'   || to_char(now(), 'YYYY-MM-DD');
    elsif rec.cadence = 'weekly' then
      s := date_trunc('week', now());  e := s + interval '7 days';
      tid := rec.game || '-weekly-'  || to_char(now(), 'IYYY-IW');
    else
      s := date_trunc('month', now()); e := s + interval '1 month';
      tid := rec.game || '-monthly-' || to_char(now(), 'YYYY-MM');
    end if;

    insert into public.tournaments
      (id, game_id, title_en, title_am, type, entry_fee_coins, attempts,
       prize_model, sponsored_prize, prize_tiers, starts_at, ends_at, state)
    values
      (tid, rec.game, rec.title_en, rec.title_am, 'paid', rec.fee, rec.attempts,
       'pool', 0, tiers, s, e, 'live')
    on conflict (id) do update set
      starts_at = excluded.starts_at,
      ends_at   = excluded.ends_at,
      state     = case when public.tournaments.state = 'settled' then 'settled' else 'live' end;
  end loop;
end;
$$;

-- 5) game_stats: strip the dated cadence suffix so per-window scores aggregate
--    under their game. Handles both dated (`-daily-2026-06-27`) and legacy bare
--    (`-monthly`) ids. Runner scores stay unioned as frozen history.
create or replace function public.refresh_game_stats()
returns void language sql security definer set search_path = public as $$
  insert into public.game_stats (game_id, p95, n, updated_at)
  select game,
         percentile_cont(0.95) within group (order by best)::numeric,
         count(*), now()
  from (
    select regexp_replace(tournament_id, '-(daily|weekly|monthly)(-[0-9-]+)?$', '') as game, best
      from public.scores where best > 0
    union all
    select 'temple-dash' as game, best from public.runner_scores where best > 0
  ) t
  group by game
  on conflict (game_id) do update
    set p95 = excluded.p95, n = excluded.n, updated_at = excluded.updated_at;
$$;

-- 6) Public pool aggregate per tournament: 65% of fees + per-cadence top-up
--    (mirrors the old runner_pools). Cadence parsed from the id. Drop first — the
--    existing view has a different column shape, which CREATE OR REPLACE can't alter.
drop view if exists public.tournament_pools;
create view public.tournament_pools
with (security_invoker = off) as
select
  e.tournament_id,
  (case when e.tournament_id ~ '-daily-'  then 'daily'
        when e.tournament_id ~ '-weekly-' then 'weekly'
        else 'monthly' end)                                as period,
  count(*)::bigint                                          as entrants,
  coalesce(sum(e.fee_paid), 0)                              as fees_total,
  (round(coalesce(sum(e.fee_paid), 0) * 0.65)
    + case when e.tournament_id ~ '-daily-'  then 200
           when e.tournament_id ~ '-weekly-' then 1000
           else 5000 end)::bigint                           as pool
from public.tournament_entries e
group by e.tournament_id;
grant select on public.tournament_pools to anon, authenticated;

-- 7) settle_due_tournaments(): fee-funded pool, RP ranking, tiered coin + ticket
--    payouts (ported from settle_due_runner_tournaments). Idempotent (state
--    fence). Only paid+pooled windows; only entrants rank. Rolls next windows.
create or replace function public.settle_due_tournaments()
returns int language plpgsql security definer set search_path = public as $$
declare
  tour record; w record; n int := 0;
  total_fees bigint; pool bigint; topup bigint; coins bigint; tickets int; cadence text;
begin
  for tour in
    select * from public.tournaments
     where type = 'paid' and prize_model = 'pool'
       and state in ('live','ended','settling') and ends_at <= now()
  loop
    update public.tournaments set state = 'settling' where id = tour.id and state <> 'settled';

    select coalesce(sum(fee_paid), 0) into total_fees
      from public.tournament_entries where tournament_id = tour.id;
    cadence := case when tour.id ~ '-daily-' then 'daily'
                    when tour.id ~ '-weekly-' then 'weekly' else 'monthly' end;
    topup := case cadence when 'daily' then 200 when 'weekly' then 1000 else 5000 end;
    pool := round(total_fees * 0.65) + topup;

    for w in
      select s.user_id, rank() over (order by s.rp desc, s.updated_at asc) as rnk
        from public.scores s
        join public.tournament_entries te
          on te.user_id = s.user_id and te.tournament_id = s.tournament_id
       where s.tournament_id = tour.id
    loop
      coins := 0; tickets := 0;
      if    w.rnk = 1 then coins := round(pool * 0.50); tickets := 5;
      elsif w.rnk = 2 then coins := round(pool * 0.25); tickets := 2;
      elsif w.rnk = 3 then coins := round(pool * 0.15); tickets := 2;
      elsif w.rnk between 4 and 10 then coins := round(pool * 0.10 / 7.0);
      end if;
      if coins > 0 then
        perform public.apply_coins(w.user_id, coins, 'prize', tour.id);
        update public.tournament_entries set prize_won = coins
          where tournament_id = tour.id and user_id = w.user_id;
      end if;
      if tickets > 0 then perform public.grant_draw_tickets(w.user_id, tickets); end if;
    end loop;

    update public.tournaments set state = 'settled' where id = tour.id;
    n := n + 1;
  end loop;
  perform public.seed_tournaments(); -- open the next windows
  return n;
end;
$$;

-- 8) Lock the new/redefined definer functions to service_role.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.active_game_tournament(text)',
    'public.seed_tournaments()',
    'public.refresh_game_stats()',
    'public.settle_due_tournaments()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- 9) Cron: settle due windows every 15 min (covers daily/weekly/monthly), and
--    retire the old runner-only settle cron.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('settle-tournaments-15m')
    where exists (select 1 from cron.job where jobname = 'settle-tournaments-15m');
  perform cron.schedule('settle-tournaments-15m', '5,20,35,50 * * * *',
    $cron$ select public.settle_due_tournaments(); $cron$);
  perform cron.unschedule('settle-runner-daily')
    where exists (select 1 from cron.job where jobname = 'settle-runner-daily');
exception when others then
  raise notice 'pg_cron not configured (%); call settle_due_tournaments() on a schedule manually.', sqlerrm;
end $$;

-- 10) Open the three live windows now.
select public.seed_tournaments();
