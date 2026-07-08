-- Phase 4 portal polish: online presence, 7-day trending rollup, admin ticker strings.

-- Last-seen heartbeat for "N players online".
create table if not exists public.hub_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index if not exists hub_presence_seen_idx on public.hub_presence (last_seen_at desc);

alter table public.hub_presence enable row level security;
-- No client policies — service role / definer functions only.

create or replace function public.heartbeat_hub_presence(p_user uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.hub_presence (user_id, last_seen_at)
  values (p_user, now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

create or replace function public.get_online_player_count(p_within_seconds int default 300)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.hub_presence
  where last_seen_at > now() - make_interval(secs => greatest(30, least(coalesce(p_within_seconds, 300), 3600)));
$$;

-- 7-day play volume per game from hub_events (analytics trending).
create or replace function public.get_trending_game_ids(p_limit int default 8)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t.game_id order by t.plays desc), '[]'::jsonb)
  from (
    select game_id, count(*)::int as plays
    from public.hub_events
    where event = 'play'
      and created_at > now() - interval '7 days'
      and game_id is not null
      and game_id <> ''
    group by game_id
    order by count(*) desc
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) t;
$$;

-- Fallback: all-time game_stats when 7d feed is empty (cold start).
create or replace function public.get_trending_game_ids_with_fallback(p_limit int default 8)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  v_n int;
begin
  v := public.get_trending_game_ids(p_limit);
  v_n := coalesce(jsonb_array_length(v), 0);
  if v_n >= 3 then
    return v;
  end if;
  select coalesce(jsonb_agg(gs.game_id order by gs.n desc), '[]'::jsonb)
    into v
  from (
    select game_id, n
    from public.game_stats
    where n > 0
    order by n desc
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) gs;
  return v;
end;
$$;

revoke all on function public.heartbeat_hub_presence(uuid) from public, anon, authenticated;
grant execute on function public.heartbeat_hub_presence(uuid) to service_role;

revoke all on function public.get_online_player_count(int) from public;
grant execute on function public.get_online_player_count(int) to anon, authenticated, service_role;

revoke all on function public.get_trending_game_ids(int) from public;
grant execute on function public.get_trending_game_ids(int) to anon, authenticated, service_role;

revoke all on function public.get_trending_game_ids_with_fallback(int) from public;
grant execute on function public.get_trending_game_ids_with_fallback(int) to anon, authenticated, service_role;

-- Seed Phase 4 portal fields when missing (merge, do not wipe Phase 2/3 portal).
update public.app_config
set value = jsonb_set(
  value,
  '{portal}',
  coalesce(value->'portal', '{}'::jsonb)
    || jsonb_build_object(
      'trendingMode', coalesce(value->'portal'->>'trendingMode', 'analytics'),
      'tickerMessages', coalesce(
        value->'portal'->'tickerMessages',
        jsonb_build_array(
          jsonb_build_object(
            'en', '🟢 {online} players online',
            'am', '🟢 {online} ተጫዋቾች በመስመር ላይ'
          ),
          jsonb_build_object(
            'en', '🔥 Complete today''s challenge for bonus coins',
            'am', '🔥 ለተጨማሪ ሳንቲም የዛሬን ግብ ያጠናቅቁ'
          ),
          jsonb_build_object(
            'en', '🏆 Join the weekly championship',
            'am', '🏆 ሳምንታዊ ሻምፒዮና ይቀላቀሉ'
          )
        )
      )
    ),
  true
),
updated_at = now()
where key = 'app';
