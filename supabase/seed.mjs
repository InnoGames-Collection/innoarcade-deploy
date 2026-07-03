// InnoArcade — backend bootstrap (NO fake players or scores).
//
// Seeds app_config + live tournament windows only. Players appear on leaderboards
// after they sign in (Supabase test phone + OTP) and play tournaments.
//
// Run:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ADMIN_PHONE=+251911000000 node supabase/seed.mjs
//
// Register test phones first — see supabase/test-phones.json + DEMO_SETUP.md.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const PACKAGES = [
  { id: 'starter', coins: 20, bonus: 0, priceEtb: 5 },
  { id: 'popular', coins: 60, bonus: 10, priceEtb: 15, popular: true },
  { id: 'value', coins: 150, bonus: 30, priceEtb: 40 },
  { id: 'pro', coins: 350, bonus: 100, priceEtb: 80 },
];
const APP_CONFIG = {
  coinPackages: PACKAGES,
  paymentMethods: { telebirr: true, topup: true },
  defaultEntryFeeCoins: 1,
  houseRakePct: 10,
  maintenance: false,
  winRateOverride: null,
};

const digitsOf = (p) => String(p ?? '').replace(/[^\d]/g, '');

async function findUserId(phone) {
  const d = digitsOf(phone);
  let page = 1;
  for (;;) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const list = data?.users ?? [];
    const hit = list.find((u) => digitsOf(u.phone) === d);
    if (hit) return hit.id;
    if (list.length < 1000) break;
    page++;
  }
  return null;
}

async function main() {
  console.log(`Bootstrapping ${URL}\n`);

  await db.from('app_config').upsert({ key: 'app', value: APP_CONFIG, updated_at: new Date().toISOString() });
  console.log('• app_config ✓');

  await db.rpc('seed_tournaments');
  await db.rpc('ensure_active_season');
  const { data: tours } = await db.from('tournaments')
    .select('id, game_id').eq('state', 'live')
    .in('game_id', ['memory-match', 'fruit-slice']);
  console.log(`• tournaments ✓ (${tours?.length ?? 0} live windows)`);
  console.log('• active season ✓');

  if (ADMIN_PHONE) {
    const id = await findUserId(ADMIN_PHONE);
    if (id) {
      await db.from('profiles').update({ role: 'admin' }).eq('id', id);
      console.log(`• admin ✓ — ${ADMIN_PHONE} (must sign in at least once first)`);
    } else {
      console.log(`• admin — sign in once as ${ADMIN_PHONE}, then re-run with ADMIN_PHONE set`);
    }
  }

  console.log('\nNo demo players seeded. Add test phones (OTP 123456) in Auth → Test phone numbers.');
  console.log('List: supabase/test-phones.json — sign in, enter tournaments, play to rank.');
}

main().catch((e) => { console.error(e); process.exit(1); });
