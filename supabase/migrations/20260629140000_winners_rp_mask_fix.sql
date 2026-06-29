-- Fix mask_phone, RP season ranking (best RP not average), tournament-period
-- winners board, and profile display names from masked phone numbers.

-- --- mask: +2519****12345 (matches telecom winners UI) ----------------------
create or replace function public.mask_phone(p_phone text)
returns text language sql immutable as $$
  select '+2519****' || lpad(
    right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 5),
    5, '0'
  );
$$;

-- --- profile name = masked phone on signup ----------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ph text;
begin
  ph := case
    when new.phone is null or new.phone = '' then null
    when left(new.phone, 1) = '+' then new.phone
    else '+' || new.phone
  end;
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(public.mask_phone(ph), coalesce(new.raw_user_meta_data ->> 'name', 'Player')),
    ph
  )
  on conflict (id) do update set
    phone = coalesce(public.profiles.phone, excluded.phone),
    name = case
      when excluded.phone is not null then public.mask_phone(excluded.phone)
      else public.profiles.name
    end;
  return new;
end;
$$;

update public.profiles
   set name = public.mask_phone(phone)
 where phone is not null and phone <> '';

-- --- Per-tournament RP comes from the player's BEST raw score in that window.
-- Season / Top players: rank by the player's BEST RP in the season (max), not
-- an average across tournaments. Min 1 scored tournament to qualify.
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
  rank() over (order by a.best_rp desc, a.user_id) as rank,
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
  rank() over (order by a.best_rp desc, a.user_id) as rank,
  p.xp_lifetime,
  (select name from prev_season) as season_name
from agg a
left join public.profiles p on p.id = a.user_id;

grant select on public.previous_season_rp_leaderboard to anon, authenticated;

-- --- Leaderboards show masked phone as public name --------------------------
-- Drop dependents before leaderboard (tournament_period_board joins leaderboard).
drop view if exists public.tournament_period_board;
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = on) as
select
  s.tournament_id, s.user_id,
  coalesce(public.mask_phone(p.phone), p.name, 'Player') as name,
  s.best as score,
  rank() over (partition by s.tournament_id order by s.rp desc, s.updated_at asc) as rank,
  s.rp
from public.scores s
left join public.profiles p on p.id = s.user_id;
grant select on public.leaderboard to anon, authenticated;

-- --- Winners tab: latest tournament window per cadence (prefer ended/settled)
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

-- Redraw winners public with fixed mask (if draw winners exist).
create or replace view public.draw_winners_public
with (security_invoker = off) as
select
  w.draw_id,
  split_part(w.draw_id, '-', 1) as period,
  w.rank,
  w.prize_etb,
  public.mask_phone(p.phone) as phone_masked,
  w.created_at
from public.draw_winners w
left join public.profiles p on p.id = w.user_id;
