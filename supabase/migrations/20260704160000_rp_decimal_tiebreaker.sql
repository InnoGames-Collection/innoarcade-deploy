-- RP precision upgrade: int → numeric(6,2) + time-based micro-tiebreaker.
--
-- Problem: integer RP (1-100) produces frequent ties among players with
-- similar scores. With strict prizing policies this is unacceptable.
--
-- Solution:
--   1. Widen rp to numeric(6,2) — 10,000 possible values vs 100.
--   2. Add a time-based micro-tiebreaker (0.00–0.99) so two players with
--      identical raw scores but different completion times get different RP.
--      For timed games (Memory Match): faster finish → higher tiebreaker.
--      For survival games (Fruit Slice): longer survival → higher tiebreaker.
--   3. The primary RP component (score/baseline × 100) still dominates;
--      the tiebreaker only differentiates otherwise-equal scores.

-- 1. Drop all views that depend on the rp column before altering its type.
drop view if exists public.tournament_period_board;
drop view if exists public.leaderboard;
drop view if exists public.runner_leaderboard;
drop view if exists public.previous_season_rp_leaderboard;
drop view if exists public.season_rp_leaderboard;

-- 2. Widen the rp column on both score tables.
alter table public.scores        alter column rp type numeric(6,2);
alter table public.runner_scores alter column rp type numeric(6,2);

-- 3. Updated rp_for with time tiebreaker.
--    p_time_ms: round duration in milliseconds (0 = no tiebreaker).
--    p_max_time_ms: maximum expected duration for the game (default 120000).
--    For timed games: tiebreaker = (max - elapsed) / max * 0.99
--    For survival games: tiebreaker = min(elapsed, max) / max * 0.99
drop function if exists public.rp_for(text, bigint);
create or replace function public.rp_for(
  p_game text,
  p_raw bigint,
  p_time_ms bigint default 0,
  p_survival boolean default false
)
returns numeric(6,2) language sql stable set search_path = public as $$
  select case
    when p_raw <= 0 then 0.00
    else least(100.99, greatest(0.01, round(
      p_raw::numeric
      / greatest(
          public.game_par(p_game),
          coalesce(nullif((select p95 from public.game_stats where game_id = p_game), 0), 0)
        )
      * 100, 2)
      + case
          when p_time_ms > 0 and p_survival then
            round(least(p_time_ms, 300000)::numeric / 300000.0 * 0.99, 2)
          when p_time_ms > 0 then
            round((1.0 - least(p_time_ms, 120000)::numeric / 120000.0) * 0.99, 2)
          else 0.00
        end
    ))::numeric(6,2)
  end;
$$;

-- 4. Recreate dependent views (they reference rp which changed type).
create view public.leaderboard
with (security_invoker = on) as
select
  s.tournament_id, s.user_id,
  coalesce(public.mask_phone(p.phone), p.name, 'Player') as name,
  s.best as score,
  rank() over (
    partition by s.tournament_id
    order by s.rp desc, s.best desc, s.updated_at asc
  ) as rank,
  s.rp
from public.scores s
left join public.profiles p on p.id = s.user_id;
grant select on public.leaderboard to anon, authenticated;

create view public.tournament_period_board
with (security_invoker = on) as
with tagged as (
  select id as tournament_id, ends_at, state,
    case
      when id ~ '-daily-' then 'daily'
      when id ~ '-weekly-' then 'weekly'
      when id ~ '-monthly-' then 'monthly'
    end as cadence
  from public.tournaments
),
picked as (
  select distinct on (cadence)
    tournament_id, cadence, ends_at, state
  from tagged
  where cadence is not null
  order by cadence,
    case when state in ('settled', 'ended') then 0 else 1 end,
    ends_at desc
)
select
  p.cadence,
  p.tournament_id,
  p.ends_at,
  p.state as tournament_state,
  lb.rank,
  lb.user_id,
  lb.name,
  public.mask_phone(pr.phone) as phone_masked,
  lb.rp,
  lb.score as best_score
from picked p
join public.leaderboard lb on lb.tournament_id = p.tournament_id
left join public.profiles pr on pr.id = lb.user_id
where lb.rank <= 10;
grant select on public.tournament_period_board to anon, authenticated;

create view public.runner_leaderboard
with (security_invoker = on) as
select
  s.tournament_id, s.user_id,
  coalesce(public.mask_phone(p.phone), p.name, 'Player') as name,
  s.best as score,
  rank() over (
    partition by s.tournament_id
    order by s.rp desc, s.best desc, s.updated_at asc
  ) as rank,
  s.rp
from public.runner_scores s
left join public.profiles p on p.id = s.user_id;
grant select on public.runner_leaderboard to anon, authenticated;

create view public.season_rp_leaderboard
with (security_invoker = on) as
with season as (
  select starts_at, ends_at from public.seasons
   where status = 'active' order by ends_at desc limit 1
),
results as (
  select s.user_id, s.rp from public.scores s, season se
   where s.rp > 0 and s.updated_at >= se.starts_at and s.updated_at < se.ends_at
  union all
  select rs.user_id, rs.rp from public.runner_scores rs, season se
   where rs.rp > 0 and rs.updated_at >= se.starts_at and rs.updated_at < se.ends_at
)
select
  a.user_id,
  coalesce(p.name, 'Player') as name,
  a.best_rp,
  a.entries,
  rank() over (order by a.best_rp desc, a.user_id) as rank,
  p.xp_lifetime
from (
  select user_id, max(rp) as best_rp, count(*) as entries
  from results group by user_id
) a
left join public.profiles p on p.id = a.user_id;
grant select on public.season_rp_leaderboard to anon, authenticated;

create view public.previous_season_rp_leaderboard
with (security_invoker = on) as
with prev_season as (
  select id, name, starts_at, ends_at from public.seasons
   where status = 'closed'
   order by coalesce(settled_at, ends_at) desc
   limit 1
),
results as (
  select s.user_id, s.rp from public.scores s, prev_season se
   where s.rp > 0 and s.updated_at >= se.starts_at and s.updated_at < se.ends_at
  union all
  select rs.user_id, rs.rp from public.runner_scores rs, prev_season se
   where rs.rp > 0 and rs.updated_at >= se.starts_at and rs.updated_at < se.ends_at
)
select
  a.user_id,
  coalesce(p.name, 'Player') as name,
  a.best_rp,
  a.entries,
  rank() over (order by a.best_rp desc, a.user_id) as rank,
  p.xp_lifetime,
  (select name from prev_season) as season_name
from (
  select user_id, max(rp) as best_rp, count(*) as entries
  from results group by user_id
) a
left join public.profiles p on p.id = a.user_id;
grant select on public.previous_season_rp_leaderboard to anon, authenticated;

-- 5. Backfill existing RP with new precision (no time data yet → 0 tiebreaker).
select public.refresh_game_stats();

update public.scores s
   set rp = public.rp_for(public.game_id_from_tournament(s.tournament_id), s.best)
 where s.best > 0;

update public.runner_scores s
   set rp = public.rp_for('temple-dash', s.best)
 where s.best > 0;
