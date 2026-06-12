-- Send SMS hook (Postgres flavour) — the FREE, no-Twilio path for development.
--
-- Supabase Auth calls this function with the OTP each time a code must be sent.
-- In mock mode it writes the code to the Postgres logs (Dashboard → Logs →
-- Postgres, search "InnoArcade OTP"), so you can complete a sign-in with no SMS
-- provider and no cost. For production, either:
--   * switch the hook to HTTPS → the `send-sms` Edge Function (which posts to the
--     telecom's gateway), or
--   * extend this function to call the gateway via the pg_net extension.
--
-- Run this in: Dashboard → SQL Editor. Then in Authentication → Hooks → Send SMS,
-- choose Postgres → schema `public` → function `send_sms_hook`.

create or replace function public.send_sms_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := event #>> '{user,phone}';
  v_otp   text := event #>> '{sms,otp}';
begin
  -- MOCK delivery: the code lands in the Postgres logs.
  raise log 'InnoArcade OTP for %: %', v_phone, v_otp;

  -- Tell Auth the message was handled (no error).
  return '{}'::jsonb;
end;
$$;

-- Auth hooks run as the `supabase_auth_admin` role — it must be allowed to call
-- this, and nobody else should be.
revoke execute on function public.send_sms_hook(jsonb) from public, anon, authenticated;
grant execute on function public.send_sms_hook(jsonb) to supabase_auth_admin;
