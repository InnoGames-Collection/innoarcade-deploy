-- End stale duplicate live windows (older id schemes) and unify entry: 2 coins, 5 attempts.

create or replace function public.seed_tournaments()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  tiers jsonb := '[{"rank":1,"pct":50},{"rank":2,"pct":25},{"rank":3,"pct":15}]'::jsonb;
  tid text;
  eat date;
  wstart date;
  wend date;
  mstart date;
  mend date;
  s timestamptz;
  e timestamptz;
begin
  -- Only one live window per shipped game — end orphans from prior id formats.
  update public.tournaments
     set state = 'ended'
   where game_id in ('temple-dash', 'memory-match', 'fruit-slice')
     and state = 'live';

  eat := public.eat_today();

  for rec in
    select * from (values
      ('temple-dash',  'daily',   'Daily Runner',        'ዕለታዊ ሩጫ',    2::bigint, 5),
      ('memory-match', 'weekly',  'Weekly Cup',          'ሳምንታዊ ዋንጫ', 2::bigint, 5),
      ('fruit-slice',  'monthly', 'Monthly Championship','ወርሃዊ ሻምፒዮና',2::bigint, 5)
    ) as v(game, cadence, title_en, title_am, fee, attempts)
  loop
    if rec.cadence = 'daily' then
      s := public.eat_day_start(eat);
      e := public.eat_day_end(eat);
      tid := rec.game || '-daily-' || to_char(eat, 'YYYY-MM-DD');
    elsif rec.cadence = 'weekly' then
      wstart := eat - extract(dow from eat)::int;
      wend := wstart + 6;
      s := public.eat_day_start(wstart);
      e := public.eat_day_end(wend);
      tid := rec.game || '-weekly-' || to_char(wstart, 'YYYY-MM-DD');
    else
      mstart := date_trunc('month', eat::timestamp)::date;
      mend := (date_trunc('month', eat::timestamp) + interval '1 month - 1 day')::date;
      s := public.eat_day_start(mstart);
      e := public.eat_day_end(mend);
      tid := rec.game || '-monthly-' || to_char(mstart, 'YYYY-MM');
    end if;

    insert into public.tournaments
      (id, game_id, title_en, title_am, type, entry_fee_coins, attempts,
       prize_model, sponsored_prize, prize_tiers, starts_at, ends_at, state)
    values
      (tid, rec.game, rec.title_en, rec.title_am, 'paid', rec.fee, rec.attempts,
       'pool', 0, tiers, s, e, 'live')
    on conflict (id) do update set
      entry_fee_coins = excluded.entry_fee_coins,
      attempts        = excluded.attempts,
      starts_at       = excluded.starts_at,
      ends_at         = excluded.ends_at,
      state           = case when public.tournaments.state = 'settled' then 'settled' else 'live' end;
  end loop;
end;
$$;

select public.seed_tournaments();
