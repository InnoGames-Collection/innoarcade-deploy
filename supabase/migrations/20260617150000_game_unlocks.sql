-- Per-player game unlocks (level-gated games can be unlocked early with coins).
alter table public.profiles add column if not exists unlocks jsonb not null default '[]'::jsonb;
-- Client may read its own unlocks (write is service-role only, via unlock-game).
grant update (name, skins) on public.profiles to authenticated; -- (unchanged; unlocks NOT client-writable)
