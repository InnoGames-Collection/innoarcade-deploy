# InnoArcade backend (Supabase)

Server-authoritative scores, leaderboards and phone-OTP accounts. The app runs
fine **without** this (local mock); adding the keys lights it up.

> **Want the fully-backed demo with mocked SMS + TeleBirr?** Follow
> [`../DEMO_SETUP.md`](../DEMO_SETUP.md) — it wraps the steps below into a 6-step
> runbook where OTP shows on screen (no SMS gateway), TeleBirr is a demo hosted
> page hitting the real `payment-callback`, and coins move for real. The extra
> demo-only bits it uses: [`dev.sql`](dev.sql) (on-screen OTP table),
> [`seed.mjs`](seed.mjs) (`npm run seed`), and the `/checkout/` demo page.

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
| `enter-draw` | buy a draw ticket with points (reads cost/cap from `draws`, enforces the per-user cap) | |
| `settle-draws` | reveal seed, pick ticket-weighted winner(s), record them (or void+refund) | admin JWT *or* `x-cron-secret` |
| `runner-enter` | Ethiopian Runner: pay the entry fee (global coins) → bank N attempts | user JWT |
| `runner-submit` | Ethiopian Runner score gate: award XP every run, record ranked best + consume an attempt when entered | user JWT |
| `admin-action` | guarded operator mutations (config, tournaments, draws, coins, roles) | |

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
supabase functions deploy enter-draw
supabase functions deploy settle-draws
supabase functions deploy runner-enter
supabase functions deploy runner-submit
supabase functions deploy admin-action
```

> **Draws migrations:** apply [`migrations/20260618120000_draws.sql`](migrations/20260618120000_draws.sql)
> (the `draws` registry, private `draw_seeds`, immutable `draw_winners`, the
> `draw_pools`/`draw_winners_public` views, and the `ensure_active_draws` /
> `settle_due_draws` functions) and [`migrations/20260618130000_draws_cron.sql`](migrations/20260618130000_draws_cron.sql)
> (a 10-minute `pg_cron` tick). Winners are provably fair via **commit-reveal**:
> `draws.seed_hash` is published when a window opens and the raw seed (kept in the
> private `draw_seeds` table) is copied to `draws.revealed_seed` at settlement, so
> anyone can check `sha256(revealed_seed) = seed_hash` and recompute the winner.

> **Ethiopian Runner economy** (clean, server-only, isolated from the legacy
> shared economy): apply [`migrations/20260618140000_runner_economy.sql`](migrations/20260618140000_runner_economy.sql)
> (`runner_xp`, `runner_tournaments`, `runner_entries`, `runner_scores`, the
> `runner_leaderboard`/`runner_season_leaderboard` views, and the
> `runner_apply_xp` / `ensure_runner_tournament` / `settle_due_runner_tournaments`
> functions) and [`migrations/20260618150000_runner_cron.sql`](migrations/20260618150000_runner_cron.sql)
> (a daily `pg_cron` rollover/settlement tick). The migration seeds the first
> live monthly window. Model: every run earns **XP** (server matrix → level +
> season); a single coin **entry fee** buys N attempts whose **best raw score**
> ranks on one leaderboard. The client (`src/platform/runner.ts`) holds **no
> caches** — every read hits the server.

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
console. **Draws** auto-settle via the bundled `pg_cron` tick (every 10 min); the
admin **Draws** view also has a manual **Settle due draws** button.

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
