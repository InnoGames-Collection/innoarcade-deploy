-- Entry fee = 10 coins per attempt (source: app_config + existing rows).
update public.app_config
  set value = jsonb_set(coalesce(value, '{}'::jsonb), '{defaultEntryFeeCoins}', '10'::jsonb)
  where key = 'app';
update public.tournaments set entry_fee_coins = 10 where type = 'paid';
