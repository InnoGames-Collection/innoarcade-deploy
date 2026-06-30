-- Memory Match scoring: par aligned to time/pair/wasted-move formula (max ~3600).

create or replace function public.game_par(p_game text)
returns numeric language sql immutable set search_path = public as $$
  select case p_game
    when 'temple-dash'   then 1500
    when 'memory-match'  then 2200
    when 'fruit-slice'   then 60
    when 'orbit-blast'   then 3000
    when 'merge-2048'    then 5000
    else 100
  end::numeric;
$$;

select public.refresh_game_stats();

update public.scores s
   set rp = public.rp_for(public.game_id_from_tournament(s.tournament_id), s.best)
 where public.game_id_from_tournament(s.tournament_id) = 'memory-match'
   and s.best > 0;
