-- Season RP board: when best_rp ties, higher level (xp_lifetime) ranks first.

drop view if exists public.season_rp_leaderboard;
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
),
agg as (
  select user_id, max(rp) as best_rp, count(*) as entries
  from results group by user_id having count(*) >= 1
)
select
  a.user_id,
  coalesce(public.mask_phone(p.phone), p.name, 'Player') as name,
  a.best_rp,
  a.entries,
  rank() over (order by a.best_rp desc, p.xp_lifetime desc nulls last, a.user_id) as rank,
  p.xp_lifetime
from agg a
left join public.profiles p on p.id = a.user_id;

grant select on public.season_rp_leaderboard to anon, authenticated;

drop view if exists public.previous_season_rp_leaderboard;
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
),
agg as (
  select user_id, max(rp) as best_rp, count(*) as entries
  from results group by user_id having count(*) >= 1
)
select
  a.user_id,
  coalesce(public.mask_phone(p.phone), p.name, 'Player') as name,
  public.mask_phone(p.phone) as phone_masked,
  a.best_rp,
  a.entries,
  rank() over (order by a.best_rp desc, p.xp_lifetime desc nulls last, a.user_id) as rank,
  p.xp_lifetime,
  (select name from prev_season) as season_name
from agg a
left join public.profiles p on p.id = a.user_id;

grant select on public.previous_season_rp_leaderboard to anon, authenticated;
