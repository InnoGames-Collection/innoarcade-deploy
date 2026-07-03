-- Ethiorunner (temple-dash) is now a free game — stop seeding daily tournament windows.

create or replace function public.seed_tournaments()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  tiers jsonb := '[{"rank":1,"pct":50},{"rank":2,"pct":25},{"rank":3,"pct":15}]'::jsonb;
  tid text; s timestamptz; e timestamptz;
begin
  for rec in
    select * from (values
      ('memory-match', 'weekly',  'Weekly Cup',          'ሳምንታዊ ዋንጫ',  3::bigint, 10),
      ('fruit-slice',  'monthly', 'Monthly Championship','ወርሃዊ ሻምፒዮና', 5::bigint, 15)
    ) as v(game, cadence, title_en, title_am, fee, attempts)
  loop
    if rec.cadence = 'weekly' then
      s := date_trunc('week', now());  e := s + interval '7 days';
      tid := rec.game || '-weekly-'  || to_char(now(), 'IYYY-IW');
    else
      s := date_trunc('month', now()); e := s + interval '1 month';
      tid := rec.game || '-monthly-' || to_char(now(), 'YYYY-MM');
    end if;

    insert into public.tournaments
      (id, game_id, title_en, title_am, type, entry_fee_coins, attempts,
       prize_model, sponsored_prize, prize_tiers, starts_at, ends_at, state)
    values
      (tid, rec.game, rec.title_en, rec.title_am, 'paid', rec.fee, rec.attempts,
       'pool', 0, tiers, s, e, 'live')
    on conflict (id) do update set
      starts_at         = excluded.starts_at,
      ends_at           = excluded.ends_at,
      entry_fee_coins   = excluded.entry_fee_coins,
      attempts          = excluded.attempts,
      state             = case when public.tournaments.state = 'settled' then 'settled' else 'live' end;
  end loop;
end;
$$;

-- Close any live temple-dash tournament windows.
update public.tournaments
   set state = 'ended'
 where game_id = 'temple-dash'
   and state in ('live', 'upcoming');

select public.seed_tournaments();
