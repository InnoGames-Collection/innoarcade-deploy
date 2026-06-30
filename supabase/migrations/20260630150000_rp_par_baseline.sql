-- RP normalization: fixed par baselines + correct game id from dated tournament ids.
-- Prevents early-stage "everyone gets 100 RP" when p95 is unset or game_stats
-- keys don't match (e.g. memory-match-weekly-2026-06-22).

create or replace function public.game_id_from_tournament(p_tid text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(p_tid, '-(daily|weekly|monthly)(-[0-9-]+)?$', '');
$$;

-- "Great round" raw score per game (mirrors submit-score GAME_SCORING par values).
create or replace function public.game_par(p_game text)
returns numeric language sql immutable set search_path = public as $$
  select case p_game
    when 'temple-dash'   then 1500
    when 'memory-match'  then 400
    when 'fruit-slice'   then 60
    when 'orbit-blast'   then 3000
    when 'merge-2048'    then 5000
    else 100
  end::numeric;
$$;

create or replace function public.refresh_game_stats()
returns void language sql security definer set search_path = public as $$
  insert into public.game_stats (game_id, p95, n, updated_at)
  select game,
         percentile_cont(0.95) within group (order by best)::numeric,
         count(*), now()
  from (
    select public.game_id_from_tournament(tournament_id) as game, best
      from public.scores where best > 0
    union all
    select 'temple-dash' as game, best from public.runner_scores where best > 0
  ) t
  where game <> ''
  group by game
  on conflict (game_id) do update
    set p95 = excluded.p95, n = excluded.n, updated_at = excluded.updated_at;
$$;

-- RP = min(100, round(raw / baseline × 100)); baseline = max(rolling p95, par).
create or replace function public.rp_for(p_game text, p_raw bigint)
returns int language sql stable set search_path = public as $$
  select case
    when p_raw <= 0 then 0
    else least(100, greatest(1, round(
      p_raw::numeric
      / greatest(
          public.game_par(p_game),
          coalesce(nullif((select p95 from public.game_stats where game_id = p_game), 0), 0)
        )
      * 100)))::int
  end;
$$;

select public.refresh_game_stats();

update public.scores s
   set rp = public.rp_for(public.game_id_from_tournament(s.tournament_id), s.best)
 where s.best > 0;

update public.runner_scores s
   set rp = public.rp_for('temple-dash', s.best)
 where s.best > 0;
