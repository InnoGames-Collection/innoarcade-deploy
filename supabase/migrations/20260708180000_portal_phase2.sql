-- Phase 2 portal: recent games, hub events, daily challenge tracking + claims.

-- Continue playing shelf
create table if not exists public.user_recent_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  last_played_at timestamptz not null default now(),
  last_score int not null default 0,
  play_count int not null default 1,
  primary key (user_id, game_id)
);
create index if not exists user_recent_games_last_idx
  on public.user_recent_games (user_id, last_played_at desc);

alter table public.user_recent_games enable row level security;
drop policy if exists user_recent_games_select_own on public.user_recent_games;
create policy user_recent_games_select_own on public.user_recent_games
  for select using (auth.uid() = user_id);

-- Raw hub events (play/win/tournament) — source of truth for daily progress
create table if not exists public.hub_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text,
  event text not null,
  score int not null default 0,
  win boolean not null default false,
  meta jsonb not null default '{}',
  day date not null default (timezone('Africa/Addis_Ababa', now()))::date,
  created_at timestamptz not null default now()
);
create index if not exists hub_events_user_day_idx
  on public.hub_events (user_id, day, event);

alter table public.hub_events enable row level security;
-- No client policies — service role writes only

-- Idempotent daily challenge claim
create table if not exists public.daily_challenge_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  reward_coins int not null default 0,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_challenge_claims enable row level security;
drop policy if exists daily_challenge_claims_select_own on public.daily_challenge_claims;
create policy daily_challenge_claims_select_own on public.daily_challenge_claims
  for select using (auth.uid() = user_id);

-- Track a finished round: log event + upsert recent game. Never throws.
create or replace function public.track_hub_event(
  p_user uuid,
  p_game text,
  p_event text,
  p_score int default 0,
  p_win boolean default false,
  p_meta jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (timezone('Africa/Addis_Ababa', now()))::date;
begin
  if p_user is null or p_game is null or p_game = '' then return; end if;

  insert into public.hub_events (user_id, game_id, event, score, win, meta, day)
  values (p_user, p_game, coalesce(p_event, 'play'), greatest(0, coalesce(p_score, 0)),
          coalesce(p_win, false), coalesce(p_meta, '{}'::jsonb), v_day);

  insert into public.user_recent_games (user_id, game_id, last_played_at, last_score, play_count)
  values (p_user, p_game, now(), greatest(0, coalesce(p_score, 0)), 1)
  on conflict (user_id, game_id) do update set
    last_played_at = now(),
    last_score = greatest(public.user_recent_games.last_score, excluded.last_score),
    play_count = public.user_recent_games.play_count + 1;
end;
$$;

-- Daily challenge progress for the signed-in user (computed from hub_events today).
create or replace function public.get_daily_challenge_progress(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (timezone('Africa/Addis_Ababa', now()))::date;
  v_play_count int;
  v_win_count int;
  v_max_score int;
  v_memory_plays int;
  v_tournament_plays int;
  v_claimed boolean;
  v_reward int := 200;
begin
  select count(*)::int into v_play_count
  from public.hub_events where user_id = p_user and day = v_day and event = 'play';

  select count(*)::int into v_win_count
  from public.hub_events where user_id = p_user and day = v_day and event = 'play' and win = true;

  select coalesce(max(score), 0)::int into v_max_score
  from public.hub_events where user_id = p_user and day = v_day and event = 'play';

  select count(*)::int into v_memory_plays
  from public.hub_events where user_id = p_user and day = v_day and event = 'play' and game_id = 'memory-match';

  select count(*)::int into v_tournament_plays
  from public.hub_events where user_id = p_user and day = v_day and event = 'tournament_play';

  select exists(
    select 1 from public.daily_challenge_claims where user_id = p_user and day = v_day
  ) into v_claimed;

  return jsonb_build_object(
    'rewardCoins', v_reward,
    'claimed', v_claimed,
    'tasks', jsonb_build_array(
      jsonb_build_object('id', 'score', 'current', v_max_score, 'target', 5000, 'done', v_max_score >= 5000),
      jsonb_build_object('id', 'play3', 'current', v_play_count, 'target', 3, 'done', v_play_count >= 3),
      jsonb_build_object('id', 'memory', 'current', v_memory_plays, 'target', 1, 'done', v_memory_plays >= 1)
    ),
    'missions', jsonb_build_array(
      jsonb_build_object('id', 'play5', 'current', v_play_count, 'target', 5, 'done', v_play_count >= 5, 'reward', 50),
      jsonb_build_object('id', 'win2', 'current', v_win_count, 'target', 2, 'done', v_win_count >= 2, 'reward', 80),
      jsonb_build_object('id', 'tournament', 'current', v_tournament_plays, 'target', 1, 'done', v_tournament_plays >= 1, 'reward', 100)
    ),
    'allDone', (v_max_score >= 5000 and v_play_count >= 3 and v_memory_plays >= 1)
  );
end;
$$;

-- Claim daily challenge reward when all tasks complete (idempotent per day).
create or replace function public.claim_daily_challenge(p_user uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (timezone('Africa/Addis_Ababa', now()))::date;
  v_progress jsonb;
  v_reward int := 200;
begin
  v_progress := public.get_daily_challenge_progress(p_user);
  if not (v_progress->>'allDone')::boolean then
    return 0;
  end if;
  if exists(select 1 from public.daily_challenge_claims where user_id = p_user and day = v_day) then
    return 0;
  end if;
  v_reward := coalesce((v_progress->>'rewardCoins')::int, 200);
  insert into public.daily_challenge_claims (user_id, day, reward_coins)
  values (p_user, v_day, v_reward);
  perform public.apply_coins(p_user, v_reward, 'daily_challenge', v_day::text);
  return v_reward;
end;
$$;

revoke all on function public.track_hub_event(uuid, text, text, int, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.track_hub_event(uuid, text, text, int, boolean, jsonb) to service_role;

revoke all on function public.get_daily_challenge_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_daily_challenge_progress(uuid) to service_role;

revoke all on function public.claim_daily_challenge(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_challenge(uuid) to service_role;

-- Seed default portal block into app_config (preserves existing economy keys).
update public.app_config
set value = value || jsonb_build_object(
  'portal', jsonb_build_object(
    'promos', jsonb_build_array(
      jsonb_build_object('img', '/brand/ad-banner-1.png', 'altEn', 'Every Score Counts — climb the leaderboard', 'altAm', 'Every Score Counts — climb the leaderboard', 'href', '#games'),
      jsonb_build_object('img', '/brand/ad-banner-2.png', 'altEn', 'Weekly Fruit Slice Tournament', 'altAm', 'Weekly Fruit Slice Tournament', 'href', '#weeklyTournament'),
      jsonb_build_object('img', '/brand/ad-banner-3.png', 'altEn', 'Monthly Memory Match Tournament', 'altAm', 'Monthly Memory Match Tournament', 'href', '#weeklyTournament'),
      jsonb_build_object('img', '/brand/ad-banner-4.png', 'altEn', 'Win up to 50,000 ETB', 'altAm', 'Win up to 50,000 ETB', 'href', '#weeklyTournament')
    ),
    'news', jsonb_build_array(
      jsonb_build_object('icon', '🏆', 'textEn', 'New tournament started', 'textAm', 'አዲስ ውድድር ተጀመረ', 'ago', '2h'),
      jsonb_build_object('icon', '🎮', 'textEn', '2 new games released', 'textAm', '2 አዲስ ጨዋታዎች ተለቀቁ', 'ago', '1d'),
      jsonb_build_object('icon', '⭐', 'textEn', 'Weekend double points', 'textAm', 'የቅዳሜ እና እሁድ ድርብ ነጥቦች', 'ago', '2d'),
      jsonb_build_object('icon', '🔧', 'textEn', 'Scheduled maintenance notice', 'textAm', 'የተዘጋጀ የጥገና ማስታወቂያ', 'ago', '3d')
    ),
    'trendingGameIds', jsonb_build_array(
      'temple-dash', 'fruit-slice', 'memory-match', 'bubble-pop', 'popblast',
      'orbit-blast', 'ethiopian-quiz', 'merge-2048'
    ),
    'recentlyAddedGameIds', jsonb_build_array(
      'race-car', 'slide-puzzle', 'arrow-shot', 'ball-maze', 'pipe-connect', 'rope-rescue'
    ),
    'dailyChallenge', jsonb_build_object('rewardCoins', 200)
  )
),
updated_at = now()
where key = 'app'
  and not (value ? 'portal');
