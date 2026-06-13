# InnoArcade — Fully-backed demo (mocked SMS + TeleBirr)

This is the runbook for a **real Supabase backend** demo where **phone OTP** and
**TeleBirr payments** are *mocked but real-feeling*, and **coin movements are
genuine** (real wallet ledger in the DB). Nothing here is fake state — it's the
production code paths with the SMS gateway and the PSP swapped for stand-ins, so
going live later is just dropping in credentials.

| Piece | In this demo | For production |
| --- | --- | --- |
| Phone OTP | Real Supabase Auth session via **Test phone numbers** (fixed code, no SMS) | Deploy `send-sms` hook + `SMS_MODE=gateway` → real SMS for any number |
| TeleBirr | A demo hosted page calls the real `payment-callback` webhook | Set `TELEBIRR_*` secrets + fill 2 signing TODOs; same flow |
| Coins / wallet / orders | **Real** — `apply_coins`, `wallet_ledger`, `payment_orders` | unchanged |
| Admin | **Real** role gate (`profiles.role = 'admin'`), real data | unchanged |

Project ref: `aopmkdefqykctrxhflaq`. Run all commands from `Games/innoarcade`.

---

## What's already done in the repo

- `.env` → `VITE_ECONOMY_ONLINE=true` (backend on) and `VITE_DEV_OTP_ECHO=false`
  (sign-in uses Test phone numbers, no on-screen code). URL + anon key are set.
- The demo TeleBirr page lives at `/checkout/`; `buy-coins` redirects to it in
  sandbox and it calls the real `payment-callback`.

You do the **6 steps** below on the live project.

---

## 1. Apply the database schema

Dashboard → **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql)
— tables, RLS, `is_admin()`, `apply_coins()`, the leaderboard view, the signup
trigger. Safe to re-run.

> Skip [`supabase/dev.sql`](supabase/dev.sql) — it's only for the LOCAL on-screen
> OTP echo. This (public/shared) demo signs in with **Test phone numbers**
> instead. If `dev_otps` already exists, drop it: `drop table public.dev_otps;`.

## 2. Deploy the Edge Functions

Dashboard → **Edge Functions → Create a function**, paste each file, Deploy — or
CLI (`config.toml` is included, so `verify_jwt` is set correctly per function):

```bash
supabase login
supabase link --project-ref aopmkdefqykctrxhflaq
supabase functions deploy submit-score
supabase functions deploy buy-coins
supabase functions deploy payment-callback   # config.toml sets verify_jwt=false
supabase functions deploy enter-tournament
supabase functions deploy settle-tournament  # config.toml sets verify_jwt=false
supabase functions deploy admin-action
# supabase functions deploy send-sms         # only if you wire a real SMS gateway
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. On the modern key system (legacy keys disabled), set the secret
`SUPABASE_SERVICE_ROLE_KEY` to your `sb_secret_…` key so the economy functions
can move coins:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

> **Leave the `TELEBIRR_*` secrets UNSET** — that keeps `buy-coins` in the
> sandbox (demo TeleBirr page). Coins are still credited for real via the
> webhook; there's just no merchant charge.

## 3. Enable phone auth + add Test phone numbers (no SMS, no Twilio)

1. Dashboard → **Authentication → Sign In / Providers → Phone → Enable**.
2. Same page → **Test phone numbers** → add one row per account you'll actually
   sign in as, each with a fixed code. You only need numbers for the **humans**
   who log in (the operator + a demo player) — the ~40 seeded players are just
   data and never sign in. For example:

   | Phone | Code | Used for |
   | --- | --- | --- |
   | `+251911000000` | `123456` | admin / operator |
   | `+251911000001` | `123456` | demo player |

   Test numbers bypass SMS entirely: Supabase accepts the fixed code, so **no SMS
   gateway, no Send SMS hook, and no `dev_otps` table** are needed for sign-in.

> The `send-sms` function can stay undeployed for this demo (test numbers don't
> use it). Deploy it only when you wire a real SMS gateway for arbitrary numbers.

## 4. Seed believable demo data

Grab the **service_role / `sb_secret_…`** key (Settings → API). Set `ADMIN_PHONE`
to the **same number you added as the admin Test phone** in step 3, so you can
sign in as that operator:

```bash
SUPABASE_URL=https://aopmkdefqykctrxhflaq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
ADMIN_PHONE=+251911000000 \
npm run seed
```

This creates ~40 demo players, coin purchases (orders + ledger), the live
monthly/weekly tournaments, scores and paid entries, and promotes `ADMIN_PHONE`
to admin. Re-running only resets the demo accounts, never real players.

## 5. Run the app

```bash
npm install   # first time
npm run dev
```

- **Hub:** http://localhost:5173/ — sign in with the **demo-player test number +
  its fixed code**. Buy coins → the demo **telebirr** page → coins land in your
  real wallet. Enter the paid Monthly Championship (debits real coins).
- **Admin:** http://localhost:5173/admin/ — sign in with the **admin test number +
  its fixed code**. Dashboards show the seeded operation; adjust coins, settle
  tournaments, edit config — all server-validated.

## 5b. Deploy the frontend to Vercel

Vercel hosts only the **static frontend** — Supabase (steps 1–4) is your backend
and is unaffected. The repo is a monorepo, and `VITE_*` vars are **inlined at
build time**, so:

1. **Import the project** → set **Root Directory = `Games/innoarcade`**. Framework
   auto-detects as Vite (`vercel.json` pins `npm run build` → `dist`).
2. **Project → Settings → Environment Variables** — add the same vars as `.env`
   (`.env` is gitignored, so Vercel doesn't get it). Set them for **Production**
   (and Preview if you use it):
   ```
   VITE_SUPABASE_URL=https://aopmkdefqykctrxhflaq.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_…
   VITE_ECONOMY_ONLINE=true
   VITE_DEV_OTP_ECHO=false
   ```
   > These bake in at build time. **Change one → Redeploy** for it to take effect.
3. **Deploy.** The multi-page build serves `/`, `/admin/`, `/checkout/`, `/games/*`
   as real files — **do not add a SPA catch-all rewrite** (it would break those
   routes). No `vercel.json` `rewrites` needed.
4. **Supabase has no allow-list to update** — phone-OTP uses no redirect URLs, and
   the function CORS is `*`, so the Vercel domain calls Supabase as-is.

> ✅ **Locked down for a public URL.** With `VITE_DEV_OTP_ECHO=false` and
> `dev_otps` dropped, no OTP is ever exposed. Only the phones you added as **Test
> numbers** can sign in (everyone else's OTP would need a real SMS, which isn't
> wired), so a random visitor can't sign in as the admin. Keep the admin test
> number + its code private. For extra safety, enable Vercel password protection.

## 6. (Optional) Auto-settle tournaments

Dashboard → **Database → Cron**: POST ended tournaments to `settle-tournament`
with header `x-cron-secret: $CRON_SECRET` (set `CRON_SECRET` as a function
secret). Or just click **Settle** in the admin console.

---

## Going live later (no app changes)

- **Real SMS (arbitrary numbers, not just test phones):** deploy `send-sms`, set it as the Auth Send-SMS hook with `SEND_SMS_HOOK_SECRET`, then `supabase secrets set SMS_MODE=gateway TELECOM_SMS_URL=… TELECOM_SMS_TOKEN=…`.
- **Real TeleBirr:** `supabase secrets set TELEBIRR_APP_KEY=… TELEBIRR_APP_ID=… TELEBIRR_PUBLIC_KEY=… TELEBIRR_CHECKOUT_URL=…`, then fill the request-signing TODO in `buy-coins` and the signature-verification TODO in `payment-callback`. `buy-coins` then redirects to TeleBirr's real page instead of `/checkout/`.
- **Data sovereignty:** self-host Supabase in-country; only `VITE_SUPABASE_URL` changes.
