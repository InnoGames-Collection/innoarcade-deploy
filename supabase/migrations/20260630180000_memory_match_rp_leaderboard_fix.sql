-- Memory Match RP spread + leaderboard tie-break (runner lesson).
--
-- Symptom: hub shows "100 RP" for everyone; in-game mini-board shows a lower
-- raw score at #1 than #2 because ranks were RP ties broken by earliest submit.
--
-- Causes:
--   1. par 2200 is below current bests (~2400–3200) → many scores cap at 100 RP.
--   2. rank() tie-break was updated_at only, not raw best.
--
-- Fixes:
--   • Raise memory-match par to 3200 (~strong clear; theoretical max ~3600).
--   • Tie-break: rp desc, best desc, updated_at asc.
--   • Refresh stats + backfill RP on all score rows.

create or replace function public.game_par(p_game text)
returns numeric language sql immutable set search_path = public as $$
  select case p_game
    when 'temple-dash'   then 1500
    when 'memory-match'  then 3200
    when 'fruit-slice'   then 60
    when 'orbit-blast'   then 3000
    when 'merge-2048'    then 5000
    else 100
  end::numeric;
$$;

drop view if exists public.tournament_period_board;
drop view if exists public.leaderboard;
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

-- Runner board: same tie-break when RP ties.
drop view if exists public.runner_leaderboard;
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

select public.refresh_game_stats();

update public.scores s
   set rp = public.rp_for(public.game_id_from_tournament(s.tournament_id), s.best)
 where s.best > 0;

update public.runner_scores s
   set rp = public.rp_for('temple-dash', s.best)
 where s.best > 0;
