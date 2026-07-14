-- Phase 3: portal-first login entitlement probe (service_role via Edge Function).
-- Returns whether an MSISDN may request OTP when PORTAL_ENABLED=true.
-- Idempotent; safe to re-run.

create or replace function public.msisdn_portal_login_status(p_msisdn text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  d text := public.msisdn_digits(p_msisdn);
  v_period text;
  v_service bigint;
  v_uid uuid;
begin
  if d is null then
    return jsonb_build_object('entitled', false, 'reason', 'invalid_msisdn');
  end if;

  -- Active portal subscription by stored MSISDN or linked user phone.
  v_uid := public.user_id_for_msisdn(p_msisdn);

  select s.period, s.portal_service_id
    into v_period, v_service
    from public.subscriptions s
   where s.source = 'portal'
     and s.expires_at > now()
     and (
       (s.msisdn is not null and right(public.msisdn_digits(s.msisdn), 9) = right(d, 9))
       or (v_uid is not null and s.user_id = v_uid)
     )
   order by s.expires_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'entitled', true,
      'source', 'subscription',
      'period', v_period,
      'service_id', v_service
    );
  end if;

  -- Cold opt-in: pending entitlement waiting for first OTP signup.
  select p.period, p.portal_service_id
    into v_period, v_service
    from public.portal_pending_entitlements p
   where p.claimed_at is null
     and right(public.msisdn_digits(p.msisdn), 9) = right(d, 9)
   order by p.created_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'entitled', true,
      'source', 'pending',
      'period', v_period,
      'service_id', v_service
    );
  end if;

  -- Existing admin profiles may always OTP (ops / console).
  if exists (
    select 1
      from public.profiles pr
     where pr.role = 'admin'
       and public.msisdn_digits(pr.phone) is not null
       and right(public.msisdn_digits(pr.phone), 9) = right(d, 9)
  ) then
    return jsonb_build_object('entitled', true, 'source', 'admin');
  end if;

  return jsonb_build_object('entitled', false, 'reason', 'not_subscribed');
end;
$$;

revoke all on function public.msisdn_portal_login_status(text) from public, anon, authenticated;
grant execute on function public.msisdn_portal_login_status(text) to service_role;

comment on function public.msisdn_portal_login_status(text) is
  'Phase 3 login gate: portal subscription, pending entitlement, or admin profile.';
