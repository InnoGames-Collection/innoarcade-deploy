-- Automated Runner tournament rollover/settlement via pg_cron. Both functions
-- are idempotent (no-op when nothing is due), so a daily tick is safe. Runs at
-- 00:15 UTC. Guarded so the migration still applies without pg_cron.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('settle-runner-daily')
    where exists (select 1 from cron.job where jobname = 'settle-runner-daily');
  perform cron.schedule('settle-runner-daily', '15 0 * * *',
    $cron$ select public.ensure_runner_tournament(); select public.settle_due_runner_tournaments(); $cron$);
exception when others then
  raise notice 'pg_cron not configured (%); schedule the runner functions manually.', sqlerrm;
end $$;
