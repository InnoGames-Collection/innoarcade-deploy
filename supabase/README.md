# InnoArcade backend (Supabase)

Server-authoritative scores, leaderboards and phone-OTP accounts. The app runs
fine **without** this (local mock); adding the keys lights it up.

## 1. Create the project & get your keys

1. supabase.com → **New project** (region: closest to Ethiopia, e.g. Frankfurt).
2. **Settings → API**: copy **Project URL** and the **`anon` `public`** key.
3. In the app folder, `cp .env.example .env` and paste both values into `.env`.

> The `anon` key is public — security comes from RLS. The **`service_role`** key
> is secret; it only goes into the Edge Function (step 3), never the frontend.

## 2. Create the tables

Dashboard → **SQL Editor** → paste [`schema.sql`](schema.sql) → **Run**.
This creates the score tables (`profiles`, `scores`, the `leaderboard` view, RLS,
the signup trigger) **and** the economy: `profiles.role`, the `is_admin()` and
`apply_coins()` helpers, and `app_config`, `wallet_ledger`, `payment_orders`,
`tournaments`, `tournament_entries` with their RLS. Re-running is safe
(`if not exists` / `create or replace` throughout).

**Money integrity:** clients can *read* their own wallet/orders/entries but can
**never write** coins — every coin movement goes through `apply_coins()` inside a
service-role Edge Function (the same boundary as `scores`). `apply_coins()`
refuses to overdraw a balance, so an entry fee can't push a wallet negative.

**Make yourself an admin** (for the `/admin` console), after signing in once:

```sql
update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
```

## 3. Deploy the Edge Functions

**Easiest — dashboard (no CLI):** Dashboard → **Edge Functions → Create a
function**, paste each file, **Deploy**. The functions are:

| Function | Purpose | Deploy note |
| --- | --- | --- |
| `submit-score` | score gate (now also checks tournament live + paid entry) | |
| `send-sms` | OTP delivery hook | |
| `buy-coins` | open a coin purchase (sandbox or TeleBirr) | |
| `payment-callback` | TeleBirr webhook / sandbox completer → credits coins | **`--no-verify-jwt`** (provider has no user JWT) |
| `enter-tournament` | debit entry fee + record entry | |
| `settle-tournament` | pay out prizes, mark settled | admin JWT *or* `x-cron-secret` |
| `admin-action` | guarded operator mutations (config, tournaments, coins, roles) | |

**Or CLI** (a `config.toml` is included so this works from `Games/innoarcade`):

```bash
brew install supabase/tap/supabase   # or: scoop/standalone — avoid `npm i -g`
supabase login
supabase link --project-ref aopmkdefqykctrxhflaq
supabase functions deploy submit-score
supabase functions deploy send-sms
supabase functions deploy buy-coins
supabase functions deploy payment-callback --no-verify-jwt
supabase functions deploy enter-tournament
supabase functions deploy settle-tournament
supabase functions deploy admin-action
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. (On the modern key system, if legacy keys are disabled, set the
function secret `SUPABASE_SERVICE_ROLE_KEY` = your `sb_secret_…` key.)

## 3b. Payments — sandbox now, TeleBirr later

With **no** payment secrets set, `buy-coins` runs in **sandbox**: it credits the
coins immediately and marks the order paid, so the coin store and paid
tournaments are fully demoable without a merchant account.

To go live with **TeleBirr**, set the function secrets and the adapter activates
with no client/schema change:

```bash
supabase secrets set TELEBIRR_APP_KEY=… TELEBIRR_APP_ID=… \
  TELEBIRR_PUBLIC_KEY=… TELEBIRR_CHECKOUT_URL=… CRON_SECRET=…
```

Then fill the two marked `TODO` blocks: request signing in `buy-coins` and
notification verification in `payment-callback`. Point your TeleBirr merchant
**notify URL** at the deployed `payment-callback`.

**Auto-settle tournaments** with a scheduled job (Dashboard → **Database → Cron**,
or `pg_cron`) that POSTs ended tournaments to `settle-tournament` with the
`x-cron-secret: $CRON_SECRET` header — or just click **Settle** in the admin
console.

## 4. Phone auth — free, no Twilio

1. Dashboard → **Authentication → Sign In / Providers → Phone** → **Enable**.
2. **Free testing (no SMS sent):** same page → **Test phone numbers** → add e.g.
   `+251911000000` with OTP `123456`. Sign in with that number+code — no provider,
   no cost. Use this for demos and development.
3. **Real delivery without Twilio** — use the **Send SMS Hook** instead of a paid
   provider: Dashboard → **Authentication → Hooks → Send SMS → Edge Function:
   `send-sms`**, then copy the generated secret into the function's
   `SEND_SMS_HOOK_SECRET`. The `send-sms` function has two modes (set `SMS_MODE`):
   - `mock` (default) — logs the OTP to the function logs (free).
   - `gateway` — POSTs to `TELECOM_SMS_URL` (the carrier's gateway **or** a
     self-hosted open-source Android SMS gateway like `capcom6/android-sms-gateway`,
     which sends real SMS off your own SIM for free).

   **Telecom hand-off:** flip `SMS_MODE=gateway` and set `TELECOM_SMS_URL` /
   `TELECOM_SMS_TOKEN` — no app or schema change.

## How the app uses it

- [`src/platform/supabase.ts`](../src/platform/supabase.ts) — client + `isConfigured()`.
- [`src/platform/auth.ts`](../src/platform/auth.ts) — `requestOtp` / `verifyOtp` / `currentUser`.
- [`src/platform/backend.ts`](../src/platform/backend.ts) — `submitScoreRemote` (calls
  the Edge Function) and `leaderboardRemote` / `playerStandingRemote` (read the view).
  These mirror the mock in `tournaments.ts`, so the hub and games adopt them incrementally.
- [`src/platform/config.ts`](../src/platform/config.ts) — coin packages / fees / flags
  (`app_config`), with baked-in defaults so the store renders offline.
- [`src/platform/wallet.ts`](../src/platform/wallet.ts) — balance + ledger; reads only,
  mutations are server-side (`apply_coins`).
- [`src/platform/payments.ts`](../src/platform/payments.ts) — coin checkout (`buy-coins`
  → `payment-callback`), sandbox when no merchant keys.
- [`src/platform/admin.ts`](../src/platform/admin.ts) — operator API behind `admin-action`
  / `settle-tournament`; powers the [`/admin`](../admin/index.html) console.

## Going to production / data sovereignty

For the telecom deployment, **self-host Supabase on their infrastructure**
(docker-compose / k8s). The schema, function and client code are unchanged — only
`VITE_SUPABASE_URL` points at the in-country instance. This keeps player data
resident in Ethiopia, which a national carrier will require.

## Anti-cheat — current vs. next

Implemented: server-only writes, JWT identity, per-game score ceilings,
best-only, basic rate limiting. **Next** (before real prizes): per-run signed
tokens / seed-replay verification so a score must correspond to a real play
session, plus anomaly detection on submission patterns.
