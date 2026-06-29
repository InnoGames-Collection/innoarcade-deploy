-- Masked phone format (+2519***12345), season winners feed, and top-3 season
-- prizes aligned to the default monthly coin catalogue (Pro / Value / Popular).

-- --- phone mask: +2519*** + last 5 digits ------------------------------------
create or replace function public.mask_phone(p_phone text)
returns text language sql immutable as $$
  select '+2519***' || lpad(
    right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 5),
    5, '0'
  );
$$;

-- Draw winners — same mask format.
create or replace view public.draw_winners_public
with (security_invoker = off) as
select
  w.draw_id,
  split_part(w.draw_id, '-', 1) as period,
  w.rank,
  w.prize_etb,
  public.mask_phone(p.phone) as phone_masked,
  w.created_at
from public.draw_winners w
left join public.profiles p on p.id = w.user_id;

-- Previous (most recently closed) season — top finishers for the hub Winners tab.
create or replace view public.season_winners_public
with (security_invoker = on) as
select
  sp.rank,
  public.mask_phone(p.phone) as phone_masked,
  coalesce(p.name, 'Player') as name,
  sp.coins,
  sp.xp as avg_rp,
  s.name as season_name,
  sp.user_id,
  sp.season_id
from public.season_payouts sp
join public.profiles p on p.id = sp.user_id
join public.seasons s on s.id = sp.season_id
where s.status = 'closed'
  and s.id = (
    select id from public.seasons
     where status = 'closed'
     order by coalesce(settled_at, ends_at) desc
     limit 1
  );

grant select on public.season_winners_public to anon, authenticated;

-- Season settlement — top 10 coin prizes mirror the default store catalogue:
--   1st Pro (1300), 2nd Value (600), 3rd Popular (220), then 100/50 for 4–10.
create or replace function public.settle_due_seasons()
returns int language plpgsql security definer set search_path = public as $$
declare s record; r record; n int := 0; prize bigint; tickets int;
begin
  for s in select * from public.seasons where status = 'active' and ends_at <= now() loop
    for r in
      with results as (
        select sc.user_id, sc.rp from public.scores sc
          where sc.rp > 0 and sc.updated_at >= s.starts_at and sc.updated_at < s.ends_at
        union all
        select rs.user_id, rs.rp from public.runner_scores rs
          where rs.rp > 0 and rs.updated_at >= s.starts_at and rs.updated_at < s.ends_at
      ), agg as (
        select user_id, avg(rp) as avg_rp, count(*) as entries
        from results group by user_id having count(*) >= 3
      )
      select user_id, avg_rp,
             rank() over (order by avg_rp desc, user_id) as rank
      from agg
      order by avg_rp desc, user_id
      limit 10
    loop
      if    r.rank = 1            then prize := 1300; tickets := 10;  -- Pro pack
      elsif r.rank = 2            then prize := 600;  tickets := 5;   -- Value pack
      elsif r.rank = 3            then prize := 220;  tickets := 3;   -- Popular pack
      elsif r.rank in (4, 5)      then prize := 100;  tickets := 0;
      elsif r.rank between 6 and 10 then prize := 50;  tickets := 0;
      else prize := 0; tickets := 0;
      end if;

      if prize > 0 then
        perform public.apply_coins(r.user_id, prize, 'season_prize', s.id::text);
        insert into public.season_payouts (season_id, user_id, rank, xp, coins)
        values (s.id, r.user_id, r.rank, round(r.avg_rp)::bigint, prize)
        on conflict (season_id, user_id) do nothing;
      end if;
      if tickets > 0 then perform public.grant_draw_tickets(r.user_id, tickets); end if;
    end loop;

    update public.seasons set status = 'closed', settled_at = now() where id = s.id;
    update public.profiles set xp_season = 0 where xp_season <> 0;
    perform public.ensure_active_season();
    n := n + 1;
  end loop;
  return n;
end;
$$;
