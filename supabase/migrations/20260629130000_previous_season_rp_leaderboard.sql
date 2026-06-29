-- Winners tab = previous closed season RP board (same rules as season_rp_leaderboard).
-- mask_phone is defined in 20260629120000; recreated in 20260629140000 if missing.

create or replace function public.mask_phone(p_phone text)
returns text language sql immutable as $$
  select '+2519****' || lpad(
    right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 5),
    5, '0'
  );
$$;

drop view if exists public.season_winners_public;

create or replace view public.previous_season_rp_leaderboard
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
  select user_id, round(avg(rp), 1) as avg_rp, count(*) as entries
  from results group by user_id having count(*) >= 3
)
select
  a.user_id,
  coalesce(p.name, 'Player') as name,
  public.mask_phone(p.phone) as phone_masked,
  a.avg_rp,
  a.entries,
  rank() over (order by a.avg_rp desc, a.user_id) as rank,
  p.xp_lifetime,
  (select name from prev_season) as season_name
from agg a
left join public.profiles p on p.id = a.user_id;

grant select on public.previous_season_rp_leaderboard to anon, authenticated;
