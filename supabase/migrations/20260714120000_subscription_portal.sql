-- Middleware subscription portal integration (Supabase path).
-- Schema for portal webhooks, SMS audit, and entitlement linking by MSISDN.
-- Field names for inbound payloads are stub-compatible; refine when portal OpenAPI lands.
-- Idempotent; safe to re-run.

-- ------------------------------------------------------------ portal_events ---
-- Raw inbound webhook audit. Unique event_id → duplicate deliveries are no-ops.
create table if not exists public.portal_events (
  id           bigint generated always as identity primary key,
  event_id     text not null,
  event_type   text not null,
  msisdn       text,
  payload      jsonb not null default '{}',
  processed_at timestamptz not null default now(),
  unique (event_id)
);
create index if not exists portal_events_msisdn_idx on public.portal_events (msisdn);
create index if not exists portal_events_type_idx on public.portal_events (event_type);
alter table public.portal_events enable row level security;
-- service_role only (no client policies)

-- ------------------------------------------------------------- sms_messages ---
create table if not exists public.sms_messages (
  id            bigint generated always as identity primary key,
  portal_msg_id text,
  template_code text not null,
  msisdn        text not null,
  status        text not null default 'queued'
                check (status in ('queued','submitted','DELIVRD','EXPIRED','FAILED','UNKNOWN')),
  vars          jsonb not null default '{}',
  last_dlr_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sms_messages_msisdn_idx on public.sms_messages (msisdn);
create unique index if not exists sms_messages_portal_msg_id_uidx
  on public.sms_messages (portal_msg_id) where portal_msg_id is not null;
alter table public.sms_messages enable row level security;
-- service_role only

-- ----------------------------------------------- subscriptions (portal cols) ---
alter table public.subscriptions
  add column if not exists source text not null default 'app'
    check (source in ('app','portal'));
alter table public.subscriptions
  add column if not exists external_id text;
alter table public.subscriptions
  add column if not exists msisdn text;
-- Portal may send method-like values we don't know yet; widen check by recreating.
-- Keep existing telebirr/topup; add 'portal' for middleware-billed subs.
do $$
begin
  alter table public.subscriptions drop constraint if exists subscriptions_method_check;
exception when undefined_object then null;
end $$;
alter table public.subscriptions
  add constraint subscriptions_method_check
  check (method in ('telebirr','topup','portal'));

create unique index if not exists subscriptions_external_id_uidx
  on public.subscriptions (external_id) where external_id is not null;

-- ----------------------------------------- pending entitlements (cold opt-in) ---
-- SMS-first opt-in before the player has an auth account. Claimed on first OTP
-- sign-in (handle_new_user / claim_pending_portal_entitlements).
create table if not exists public.portal_pending_entitlements (
  id           bigint generated always as identity primary key,
  msisdn       text not null,
  period       text not null check (period in ('daily','weekly','monthly')),
  external_id  text,
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  claimed_user uuid references auth.users (id) on delete set null
);
create unique index if not exists portal_pending_msisdn_open_uidx
  on public.portal_pending_entitlements (msisdn)
  where claimed_at is null;
alter table public.portal_pending_entitlements enable row level security;

-- Normalise to digits-only for matching (+2519… / 09… / 2519…).
create or replace function public.msisdn_digits(p text)
returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '');
$$;

-- Resolve auth user id by phone digits (profiles.phone or auth.users.phone).
create or replace function public.user_id_for_msisdn(p_msisdn text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  d text := public.msisdn_digits(p_msisdn);
  uid uuid;
begin
  if d is null then return null; end if;
  -- Match last 9–12 digits to tolerate 0/251/+251 prefixes.
  select p.id into uid
    from public.profiles p
   where public.msisdn_digits(p.phone) is not null
     and right(public.msisdn_digits(p.phone), 9) = right(d, 9)
   limit 1;
  if uid is not null then return uid; end if;
  select u.id into uid
    from auth.users u
   where public.msisdn_digits(u.phone) is not null
     and right(public.msisdn_digits(u.phone), 9) = right(d, 9)
   limit 1;
  return uid;
end;
$$;
revoke all on function public.user_id_for_msisdn(text) from public, anon, authenticated;
grant execute on function public.user_id_for_msisdn(text) to service_role;

-- Claim open pending portal entitlements for a newly signed-in user.
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
    insert into public.subscriptions (user_id, period, method, started_at, expires_at, trial, source, external_id, msisdn)
    values (p_user, r.period, 'portal', started, exp, false, 'portal', r.external_id, r.msisdn);
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

-- Hook into signup: preserve early-stage economy signup rewards + claim pending portal sub.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ph text;
begin
  ph := case
    when new.phone is null or new.phone = '' then null
    when left(new.phone, 1) = '+' then new.phone
    else '+' || new.phone
  end;
  insert into public.profiles (id, name, phone, coins, ref_code)
  values (
    new.id,
    coalesce(public.mask_phone(ph), coalesce(new.raw_user_meta_data ->> 'name', 'Player')),
    ph,
    5,
    public.gen_ref_code()
  )
  on conflict (id) do update set
    phone = coalesce(public.profiles.phone, excluded.phone),
    name = case
      when excluded.phone is not null then public.mask_phone(excluded.phone)
      else public.profiles.name
    end,
    ref_code = coalesce(public.profiles.ref_code, excluded.ref_code);
  perform public.claim_pending_portal_entitlements(new.id, ph);
  return new;
end;
$$;
