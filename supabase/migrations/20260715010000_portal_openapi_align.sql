-- Align portal schema with partner-mt-and-webhooks.openapi.yaml (Phases 1–2).
-- - portal_service_id on subscriptions + pending entitlements
-- - sms_messages: MT correlation (ext / platform transaction ids), mt_type, failure_reason
-- - status check widened for success|failed (OpenAPI MT callback)
-- Idempotent; safe to re-run.

-- ----------------------------------------------- subscriptions.portal_service_id ---
alter table public.subscriptions
  add column if not exists portal_service_id bigint;

create index if not exists subscriptions_portal_service_id_idx
  on public.subscriptions (portal_service_id)
  where portal_service_id is not null;

create index if not exists subscriptions_msisdn_active_idx
  on public.subscriptions (msisdn)
  where msisdn is not null;

-- --------------------------------- portal_pending_entitlements.portal_service_id ---
alter table public.portal_pending_entitlements
  add column if not exists portal_service_id bigint;

-- Allow one open pending row per (msisdn, service) for multi-service MSISDNs.
drop index if exists public.portal_pending_msisdn_open_uidx;
create unique index if not exists portal_pending_msisdn_service_open_uidx
  on public.portal_pending_entitlements (msisdn, portal_service_id)
  where claimed_at is null;

-- ---------------------------------------------------------- sms_messages columns ---
alter table public.sms_messages
  add column if not exists ext_transaction_id text;
alter table public.sms_messages
  add column if not exists portal_transaction_id text;
alter table public.sms_messages
  add column if not exists mt_type text;
alter table public.sms_messages
  add column if not exists failure_reason text;
alter table public.sms_messages
  add column if not exists portal_service_id bigint;

create unique index if not exists sms_messages_ext_transaction_id_uidx
  on public.sms_messages (ext_transaction_id)
  where ext_transaction_id is not null;

create index if not exists sms_messages_portal_transaction_id_idx
  on public.sms_messages (portal_transaction_id)
  where portal_transaction_id is not null;

-- Widen status check: OpenAPI uses success|failed; keep legacy DLR labels.
do $$
begin
  alter table public.sms_messages drop constraint if exists sms_messages_status_check;
exception when undefined_object then null;
end $$;

alter table public.sms_messages
  add constraint sms_messages_status_check
  check (status in (
    'queued', 'submitted', 'success', 'failed',
    'DELIVRD', 'EXPIRED', 'FAILED', 'UNKNOWN'
  ));

-- --------------- claim_pending: copy portal_service_id onto new subscriptions ---
create or replace function public.claim_pending_portal_entitlements(p_user uuid, p_phone text)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  days int;
  started timestamptz := now();
  exp timestamptz;
begin
  if p_user is null then return 0; end if;
  for r in
    select *
      from public.portal_pending_entitlements
     where claimed_at is null
       and right(public.msisdn_digits(msisdn), 9) = right(public.msisdn_digits(p_phone), 9)
  loop
    days := case r.period when 'daily' then 1 when 'weekly' then 7 else 30 end;
    exp := started + make_interval(days => days);
    insert into public.subscriptions (
      user_id, period, method, started_at, expires_at, trial,
      source, external_id, msisdn, portal_service_id
    )
    values (
      p_user, r.period, 'portal', started, exp, false,
      'portal', r.external_id, r.msisdn, r.portal_service_id
    );
    update public.portal_pending_entitlements
       set claimed_at = now(), claimed_user = p_user
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.claim_pending_portal_entitlements(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_pending_portal_entitlements(uuid, text) to service_role;
