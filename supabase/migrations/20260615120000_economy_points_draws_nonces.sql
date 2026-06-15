-- Economy v2: server-authoritative points, draw tickets, and anti-cheat nonces.
-- Idempotent; safe to re-run.

alter table public.profiles add column if not exists points bigint not null default 0;

create or replace function public.apply_points(p_user uuid, p_delta bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_bal bigint;
begin
  update public.profiles set points = points + p_delta
   where id = p_user and points + p_delta >= 0
   returning points into new_bal;
  if new_bal is null then
    raise exception 'insufficient_or_missing' using errcode = 'check_violation';
  end if;
  return new_bal;
end;
$$;

create table if not exists public.draw_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  draw_id text not null,
  tickets integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, draw_id)
);
alter table public.draw_entries enable row level security;
drop policy if exists "read own draw entries" on public.draw_entries;
create policy "read own draw entries" on public.draw_entries for select using (auth.uid() = user_id);

create table if not exists public.used_nonces (
  jti text primary key,
  user_id uuid,
  used_at timestamptz not null default now()
);
alter table public.used_nonces enable row level security;
