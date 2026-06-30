-- Memory Match tournament scoring finalize (Phase 5).
--
-- Client formula (authoritative for raw score):
--   score = max(0, timeGain + pairGain − moveLoss)
--   timeGain  = 3000 − spentSeconds × 27
--   pairGain  = pairs × 100
--   moveLoss  = (moves − pairs) × 52
-- Theoretical max raw: 3600 (instant 6-move perfect clear).
--
-- Server: submit-score MAX 5000, GAME_SCORING par 3600.
-- RP: baseline = max(game_par, p95); 100 RP ≈ near-perfect run.

create or replace function public.game_par(p_game text)
returns numeric language sql immutable set search_path = public as $$
  select case p_game
    when 'temple-dash'   then 1500
    when 'memory-match'  then 3600
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
