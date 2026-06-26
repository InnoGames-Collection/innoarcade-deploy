-- Real, auditable prize draws — the server-authoritative lottery layer.
--
-- Until now the draw "winners" shown on the hub were SIMULATED client-side
-- (draws.ts:recentWinners via mulberry32). This migration makes draws real:
--   * a `draws` registry (mirrors `tournaments`) with the prize, ticket cost,
--     per-user ticket cap and a COMMITTED seed hash;
--   * a private `draw_seeds` table holding the raw seed (revealed only at
--     settlement) — this is the commit-reveal that makes a draw provably fair;
--   * an immutable `draw_winners` table + a masked public winners view;
--   * deterministic, weighted winner selection from the revealed seed;
--   * idempotent settlement with a state fence, mirroring settle_due_seasons().
--
-- Security model matches the rest of the economy: clients READ, only service-role
-- Edge Functions / cron WRITE; admin edits gated by is_admin().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- draws ------
-- One row per draw window (daily/weekly/monthly). `seed_hash` is published when
-- the window opens (the commitment); `revealed_seed` stays NULL until the draw
-- settles, at which point anyone can verify sha256(revealed_seed) = seed_hash.
create table if not exists public.draws (
  id                   text primary key,
  period               text not null check (period in ('daily','weekly','monthly')),
  title_en             text not null,
  title_am             text not null,
  prize_etb            bigint not null default 0,
  ticket_cost_points   bigint not null default 0,
  max_tickets_per_user integer not null default 50,
  min_tickets          bigint not null default 0,   -- below this the draw voids + refunds
  winner_count         integer not null default 1,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  state                text not null default 'open' check (state in ('open','drawing','settled','void')),
  seed_hash            text not null,                -- commitment: sha256(seed)
  revealed_seed        text,                          -- revealed at settlement
  total_tickets        bigint,                        -- snapshot taken at settlement
  created_at           timestamptz not null default now()
);
alter table public.draws enable row level security;

drop policy if exists "draws readable" on public.draws;
create policy "draws readable" on public.draws for select using (true);

drop policy if exists "draws admin write" on public.draws;
create policy "draws admin write" on public.draws
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ draw_seeds -----
-- Raw seeds are PRIVATE: RLS is on with NO policies, so only the service role
-- (which bypasses RLS) can read them. The public sees only `draws.seed_hash`
-- until the draw settles and the seed is copied into `draws.revealed_seed`.
create table if not exists public.draw_seeds (
  draw_id text primary key references public.draws (id) on delete cascade,
  seed    text not null
);
alter table public.draw_seeds enable row level security; -- service-role only; no client policies

-- ----------------------------------------------------------- draw_winners ---
-- Immutable record of who won each draw. Public to read (transparent winners),
-- written only by the settlement function (service role). `ticket_index` is the
-- random target into the cumulative ticket space — published for auditability.
create table if not exists public.draw_winners (
  draw_id            text not null references public.draws (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  rank               integer not null,
  prize_etb          bigint not null,
  ticket_index       bigint not null default 0,
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending','paid','failed')),
  created_at         timestamptz not null default now(),
  primary key (draw_id, rank)
);
create index if not exists draw_winners_draw_idx on public.draw_winners (draw_id);
alter table public.draw_winners enable row level security;

drop policy if exists "draw winners readable" on public.draw_winners;
create policy "draw winners readable" on public.draw_winners for select using (true);

-- Speed up the per-window aggregates the pool view / settlement compute.
create index if not exists draw_entries_draw_idx on public.draw_entries (draw_id);

-- ------------------------------------------------------------- draw_pools ----
-- Public aggregate (entrants + total tickets) per draw. draw_entries is
-- owner-only readable, so a definer view exposes ONLY the counts (no user ids),
-- safe to show on the hub for live odds. Mirrors tournament_pools.
create or replace view public.draw_pools
with (security_invoker = off) as
select
  draw_id,
  count(*)::bigint            as entrants,
  coalesce(sum(tickets), 0)   as total_tickets
from public.draw_entries
group by draw_id;
grant select on public.draw_pools to anon, authenticated;

-- ----------------------------------------------------- draw_winners_public ---
-- The masked winners feed for the hub: derives the period from the draw id and
-- masks the phone, so the public never sees raw user ids or full numbers.
create or replace view public.draw_winners_public
with (security_invoker = off) as
select
  w.draw_id,
  split_part(w.draw_id, '-', 1) as period,
  w.rank,
  w.prize_etb,
  case
    when p.phone is null or length(p.phone) < 7 then '+2519****'
    else left(p.phone, 5) || '****' || right(p.phone, 2)
  end as phone_masked,
  w.created_at
from public.draw_winners w
left join public.profiles p on p.id = w.user_id;
grant select on public.draw_winners_public to anon, authenticated;

-- --------------------------------------------------------------- draw_rand ---
-- Deterministic PRNG in [0,1) from (seed, index). SHA-256 keyed so the winner is
-- reproducible offline from the revealed seed — the heart of provable fairness.
create or replace function public.draw_rand(p_seed text, p_idx int)
returns double precision language sql immutable as $$
  select ('x' || substr(encode(digest(p_seed || ':' || p_idx::text, 'sha256'), 'hex'), 1, 13))::bit(52)::bigint::double precision
         / (2::double precision ^ 52);
$$;

-- ------------------------------------------------------- ensure_active_draws -
-- Make sure the current daily/weekly/monthly windows exist, each with a freshly
-- COMMITTED seed (hash public, raw seed kept private in draw_seeds). Re-running
-- is safe: an existing window is never disturbed (its commitment must be stable).
create or replace function public.ensure_active_draws()
returns void language plpgsql security definer set search_path = public as $$
declare
  d_start timestamptz := date_trunc('day', now());
  w_start timestamptz := date_trunc('week', now());
  m_start timestamptz := date_trunc('month', now());
  week_idx bigint := floor(extract(epoch from (w_start + interval '7 days')) * 1000 / 604800000);
  yr int := extract(year from now())::int;
  rec record;
  v_seed text;
begin
  for rec in
    select * from (values
      ('daily-'   || yr || '-' || extract(month from now())::int || '-' || extract(day from now())::int,
        'daily',   'Daily Draw',   'ዕለታዊ ዕጣ',   20000::bigint,  50::bigint,
        d_start, d_start + interval '1 day'),
      ('weekly-'  || yr || '-' || week_idx,
        'weekly',  'Weekly Draw',  'ሳምንታዊ ዕጣ',  50000::bigint,  120::bigint,
        w_start, w_start + interval '7 days'),
      ('monthly-' || yr || '-' || extract(month from now())::int,
        'monthly', 'Monthly Draw', 'ወርሃዊ ዕጣ',   250000::bigint, 300::bigint,
        m_start, m_start + interval '1 month')
    ) as v(id, period, title_en, title_am, prize_etb, cost, starts_at, ends_at)
  loop
    if exists (select 1 from public.draws where id = rec.id) then
      continue; -- commitment already published for this window; leave it alone
    end if;
    v_seed := encode(gen_random_bytes(32), 'hex');
    insert into public.draws
      (id, period, title_en, title_am, prize_etb, ticket_cost_points,
       starts_at, ends_at, state, seed_hash)
    values
      (rec.id, rec.period, rec.title_en, rec.title_am, rec.prize_etb, rec.cost,
       rec.starts_at, rec.ends_at, 'open', encode(digest(v_seed, 'sha256'), 'hex'))
    on conflict (id) do nothing;
    insert into public.draw_seeds (draw_id, seed)
      values (rec.id, v_seed) on conflict (draw_id) do nothing;
  end loop;
end;
$$;

-- ------------------------------------------------------- settle_due_draws ----
-- Settle every draw whose window has closed: reveal the seed, snapshot the
-- ticket pool, pick the winner(s) deterministically (weighted by tickets), and
-- record them. If the pool is under `min_tickets` the draw VOIDS and points are
-- refunded. Idempotent — a state fence (open|drawing -> settled/void) plus
-- on-conflict-do-nothing make re-runs safe. Returns the number of draws settled.
create or replace function public.settle_due_draws()
returns int language plpgsql security definer set search_path = public as $$
declare
  d record; e record;
  v_seed text; v_total bigint; v_rem bigint; v_target bigint; v_winner uuid;
  v_picked uuid[]; v_rank int; v_prize bigint; n int := 0;
begin
  for d in
    select * from public.draws
     where state in ('open','drawing') and ends_at <= now()
  loop
    -- Fence concurrent runs.
    update public.draws set state = 'drawing' where id = d.id and state = 'open';

    select seed into v_seed from public.draw_seeds where draw_id = d.id;
    select coalesce(sum(tickets), 0) into v_total from public.draw_entries where draw_id = d.id;
    update public.draws set revealed_seed = v_seed, total_tickets = v_total where id = d.id;

    -- Under threshold (or empty): void and refund the points players spent.
    if v_total = 0 or v_total < d.min_tickets then
      for e in select user_id, tickets from public.draw_entries where draw_id = d.id loop
        -- Refund spendable points only; lifetime/season are not touched.
        update public.profiles set points = points + e.tickets * d.ticket_cost_points
          where id = e.user_id;
      end loop;
      update public.draws set state = 'void' where id = d.id;
      n := n + 1;
      continue;
    end if;

    -- Pick winner_count distinct winners, weighted by ticket holdings.
    v_picked := '{}';
    for v_rank in 1 .. greatest(1, d.winner_count) loop
      select coalesce(sum(tickets), 0) into v_rem
        from public.draw_entries
       where draw_id = d.id and not (user_id = any(v_picked));
      exit when v_rem <= 0;

      v_target := floor(public.draw_rand(v_seed, v_rank - 1) * v_rem);
      select user_id into v_winner from (
        select user_id,
               sum(tickets) over (order by user_id
                 rows between unbounded preceding and current row) as cum
        from public.draw_entries
        where draw_id = d.id and not (user_id = any(v_picked))
      ) q
      where q.cum > v_target
      order by q.cum asc
      limit 1;
      exit when v_winner is null;

      -- Single headline prize to rank 1; extra winners get 0 unless an operator
      -- model assigns more later (winner_count defaults to 1).
      v_prize := case when v_rank = 1 then d.prize_etb else 0 end;
      insert into public.draw_winners (draw_id, user_id, rank, prize_etb, ticket_index)
        values (d.id, v_winner, v_rank, v_prize, v_target)
        on conflict (draw_id, rank) do nothing;
      v_picked := array_append(v_picked, v_winner);
    end loop;

    update public.draws set state = 'settled' where id = d.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Lock the new SECURITY DEFINER functions to the service role (same posture as
-- the lock_definer_rpcs migration): the client never calls these directly.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.ensure_active_draws()',
    'public.settle_due_draws()',
    'public.draw_rand(text, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- Open the current windows now so the hub has live draws immediately.
select public.ensure_active_draws();
