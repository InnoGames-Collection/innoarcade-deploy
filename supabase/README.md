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
This creates `profiles`, `scores`, the `leaderboard` view, RLS policies, and a
trigger that auto-creates a profile on signup.

## 3. Deploy the Edge Functions

**Easiest — dashboard (no CLI):** Dashboard → **Edge Functions → Create a
function**. Name it `submit-score`, paste [`functions/submit-score/index.ts`](functions/submit-score/index.ts),
**Deploy**. Repeat for `send-sms` ([`functions/send-sms/index.ts`](functions/send-sms/index.ts)).

**Or CLI** (a `config.toml` is included so this works from `Games/innoarcade`):

```bash
brew install supabase/tap/supabase   # or: scoop/standalone — avoid `npm i -g`
supabase login
supabase link --project-ref aopmkdefqykctrxhflaq
supabase functions deploy submit-score
supabase functions deploy send-sms
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. (On the modern key system, if legacy keys are disabled, set the
function secret `SUPABASE_SERVICE_ROLE_KEY` = your `sb_secret_…` key.)

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
