-- Automated draw settlement via pg_cron. settle_due_draws() is idempotent
-- (no-op when nothing is due) and ensure_active_draws() only opens missing
-- windows, so a frequent tick is safe. Runs every 10 minutes so a daily draw
-- settles promptly after midnight. Guarded so the migration still applies if
-- pg_cron is unavailable (schedule it manually then).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('settle-draws-10min')
    where exists (select 1 from cron.job where jobname = 'settle-draws-10min');
  perform cron.schedule('settle-draws-10min', '*/10 * * * *',
    $cron$ select public.ensure_active_draws(); select public.settle_due_draws(); $cron$);
exception when others then
  raise notice 'pg_cron not configured (%); schedule ensure_active_draws()+settle_due_draws() manually.', sqlerrm;
end $$;
