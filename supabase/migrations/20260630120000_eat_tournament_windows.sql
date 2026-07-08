-- Tournament windows in Ethiopia (Africa/Addis_Ababa, UTC+3, no DST).
-- Daily:   00:00:00 – 23:59:59.999 EAT
-- Weekly:  Sunday 00:00 – Saturday 23:59:59.999 EAT
-- Monthly: 1st 00:00 – last day 23:59:59.999 EAT

create or replace function public.eat_today()
returns date language sql stable as $$
  select (timezone('Africa/Addis_Ababa', now()))::date;
$$;

create or replace function public.eat_day_start(p date)
returns timestamptz language sql stable as $$
  select (p::timestamp at time zone 'Africa/Addis_Ababa');
$$;

create or replace function public.eat_day_end(p date)
returns timestamptz language sql stable as $$
  select ((p::timestamp + time '23:59:59.999') at time zone 'Africa/Addis_Ababa');
$$;

create or replace function public.active_game_tournament(p_game text)
returns text language sql stable security definer set search_path = public as $$
  select id from public.tournaments
   where game_id = p_game and state = 'live'
     and now() >= starts_at and now() <= ends_at
   order by ends_at asc limit 1;
$$;

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
  eat := public.eat_today();

  for rec in
    select * from (values
      ('temple-dash',  'daily',   'Daily Runner',        'ዕለታዊ ሩጫ',    2::bigint,  5),
      ('memory-match', 'weekly',  'Weekly Cup',          'ሳምንታዊ ዋንጫ', 5::bigint,  15),
      ('fruit-slice',  'monthly', 'Monthly Championship','ወርሃዊ ሻምፒዮና',10::bigint, 30)
    ) as v(game, cadence, title_en, title_am, fee, attempts)
  loop
    if rec.cadence = 'daily' then
      s := public.eat_day_start(eat);
      e := public.eat_day_end(eat);
      tid := rec.game || '-daily-' || to_char(eat, 'YYYY-MM-DD');
    elsif rec.cadence = 'weekly' then
      wstart := eat - extract(dow from eat)::int;  -- Sunday = 0
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
      starts_at = excluded.starts_at,
      ends_at   = excluded.ends_at,
      state     = case when public.tournaments.state = 'settled' then 'settled' else 'live' end;
  end loop;
end;
$$;

select public.seed_tournaments();
