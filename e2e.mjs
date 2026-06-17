import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const H = { apikey: key, 'content-type': 'application/json' };
const aH = (t) => ({ apikey: key, Authorization: 'Bearer ' + t, 'content-type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(phone) {
  let r = await fetch(url + '/auth/v1/otp', { method: 'POST', headers: H, body: JSON.stringify({ phone }) });
  if (!r.ok) { console.log('otp send fail', phone, r.status, await r.text()); return null; }
  await sleep(1800);
  const dr = await fetch(url + '/rest/v1/dev_otps?select=code&phone=eq.' + encodeURIComponent(phone), { headers: aH(key) });
  const rows = await dr.json(); const code = rows[0] && rows[0].code;
  if (!code) { console.log('no OTP', phone, JSON.stringify(rows).slice(0, 100)); return null; }
  r = await fetch(url + '/auth/v1/verify', { method: 'POST', headers: H, body: JSON.stringify({ phone, token: code, type: 'sms' }) });
  return (await r.json()).access_token || null;
}
const me = async (t) => (await (await fetch(url + '/auth/v1/user', { headers: aH(t) })).json()).id;
const prof = async (t, cols) => {
  const id = await me(t);
  const r = await fetch(url + '/rest/v1/profiles?select=' + cols + '&id=eq.' + id, { headers: aH(t) });
  return (await r.json())[0];
};
const fn = async (t, name, body) => {
  const r = await fetch(url + '/functions/v1/' + name, { method: 'POST', headers: aH(t), body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

const A = await login('+251922200001');
const B = await login('+251922200002');
console.log('login A:', !!A, 'B:', !!B);
if (!A || !B) process.exit(1);

const pa = await prof(A, 'ref_code,coins');
const pb0 = await prof(B, 'ref_code,coins,referred_by');
console.log('A code/coins:', pa.ref_code, pa.coins, '| B coins/referred_by:', pb0.coins, pb0.referred_by);

console.log('\n--- REFERRAL ---');
const r1 = await fn(B, 'redeem-referral', { code: pa.ref_code });
console.log('redeem#1:', r1.status, JSON.stringify(r1.body));
const r2 = await fn(B, 'redeem-referral', { code: pa.ref_code });
console.log('redeem#2 (expect already):', r2.status, JSON.stringify(r2.body));
const paA = await prof(A, 'coins'); const pbA = await prof(B, 'coins,referred_by');
console.log(`A coins ${pa.coins} -> ${paA.coins} (exp +20) | B coins ${pb0.coins} -> ${pbA.coins} (exp +10) referred_by set: ${!!pbA.referred_by}`);

console.log('\n--- BUY + UNLOCK ---');
const rb = await fn(B, 'buy-coins', { packageId: 'pkg_2' });
console.log('buy-coins pkg_2:', rb.status, JSON.stringify(rb.body).slice(0, 140));
const pbBuy = await prof(B, 'coins,unlocks');
console.log('B coins after buy:', pbBuy.coins, 'unlocks:', JSON.stringify(pbBuy.unlocks));
const u1 = await fn(B, 'unlock-game', { gameId: 'luckyslot' });
console.log('unlock#1 luckyslot:', u1.status, JSON.stringify(u1.body).slice(0, 140));
const u2 = await fn(B, 'unlock-game', { gameId: 'luckyslot' });
console.log('unlock#2 (idempotent, no extra charge):', u2.status, JSON.stringify(u2.body).slice(0, 140));

console.log('\n--- SCORING / SEASON ACCRUAL ---');
const before = await prof(B, 'points,points_lifetime,points_season');
console.log('B points before:', JSON.stringify(before));
const tok = await fn(B, 'start-round', { gameId: 'ethiopian-quiz' });
const token = tok.body?.token || '';
const ss = await fn(B, 'submit-score', { gameId: 'ethiopian-quiz', score: 100, win: true, timeMs: 8000, leaderboard: true, token });
console.log('submit-score:', ss.status, JSON.stringify(ss.body).slice(0, 160));
const after = await prof(B, 'points,points_lifetime,points_season');
console.log('B points after:', JSON.stringify(after));

console.log('\n--- ANON HOLE RE-CHECK ---');
const bid = await me(B);
const hole = await fetch(url + '/rest/v1/rpc/apply_coins', { method: 'POST', headers: aH(key), body: JSON.stringify({ p_user: bid, p_delta: 9999, p_reason: 'hack', p_ref: '' }) });
console.log('anon apply_coins(+9999):', hole.status, (await hole.text()).slice(0, 80), '(expect 401/42501)');
