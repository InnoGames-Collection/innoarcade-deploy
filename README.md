# InnoArcade

A bilingual HTML5 **games platform** — canvas-based action and puzzle titles
served in two modes: **Free play** and time-boxed **Tournaments** with live
leaderboards. Built by **InnoSphere Technologies** as part of the InnoGames
platform.

Fully bilingual: **English / አማርኛ (Amharic)** — toggle on the hub or in any game.

## Platform

The hub ([index.html](index.html) + [src/hub](src/hub)) renders entirely from a
single catalogue and a tournament service, so a game appears across the
Dashboard, Tournaments and Free-games views the moment it's registered:

- **[src/platform/catalog.ts](src/platform/catalog.ts)** — the game registry:
  each title's name (EN/AM), genre, accent, thumbnail and `mode` (`free` |
  `tournament`).
- **[src/platform/tournaments.ts](src/platform/tournaments.ts)** — active
  tournament windows (live countdowns derived from the calendar) and a
  **leaderboard service**: the player's real scores merged with a deterministic
  seeded rival field, ranked. Built behind a small API (`submitScore`,
  `leaderboard`, `playerStanding`) so a real backend (e.g. Supabase) can drop in
  later without touching the games.

## Economy, payments & operations

A full competitive-tournament layer, built the same way — a clean
`src/platform/*` module with a **local mock that works offline** and a Supabase
+ Edge Function swap-in. Coins never move on the client: every credit/debit goes
through an Edge Function (the same integrity boundary as scores).

- **Sign-in** ([auth.ts](src/platform/auth.ts), [signin.ts](src/hub/signin.ts))
  — real Supabase **phone-OTP** accounts (the SIM is the identity). With no SMS
  gateway, the demo signs in via Supabase **Test phone numbers** (fixed codes);
  for local dev the `send-sms` mock can instead echo the code **on screen**
  (`VITE_DEV_OTP_ECHO`). Real SMS is one `SMS_MODE=gateway` flip away — see the
  [backend demo](#backend-demo-mocked-sms--telebirr).
- **Coin wallet** ([wallet.ts](src/platform/wallet.ts)) — balance + immutable
  ledger; a live coin chip and the player dashboard sit on the hub.
- **Coin store & payments** ([payments.ts](src/platform/payments.ts),
  [config.ts](src/platform/config.ts)) — buy coin packages via **TeleBirr** or
  **airtime top-up**. With no merchant keys it runs in **sandbox**, redirecting to
  a demo TeleBirr page ([/checkout/](src/checkout/main.ts)) that calls the real
  `payment-callback` webhook — the *exact* `pending order → hosted page → webhook
  → credit` flow, no money. Real TeleBirr drops into `buy-coins` /
  `payment-callback` with no client change.
- **Hybrid tournaments** ([tournaments.ts](src/platform/tournaments.ts)) —
  **free** (house-sponsored prizes) *and* **paid** (coin entry fee → prize pool,
  split by tiers) tournaments, with states (upcoming → live → ended → settled),
  registration, and prize settlement.
- **Admin console** ([admin/](admin/index.html), [admin.ts](src/platform/admin.ts))
  — a separate role-gated app (`profiles.role = 'admin'`): dashboards
  (revenue, coins sold, GGR, payouts), tournament create/configure/**settle**,
  player & coin management, payment monitoring, and live config. Open at
  [/admin/](http://localhost:5173/admin/). Bilingual like the hub.

> **Note:** real-money skill tournaments may require a licensing/compliance
> review in Ethiopia before launch. The code ships the mechanism; the legal
> posture is a separate decision.

### Backend demo (mocked SMS + TeleBirr)

The platform runs in two modes, switched by env:

| | Offline / local | Backend demo |
| --- | --- | --- |
| Switch | *(default — no flag)* | `VITE_ECONOMY_ONLINE=true` |
| Data | localStorage mock | **real** Supabase tables + RLS |
| Sign-in | anonymous local player | real phone-OTP session |
| Coins | local wallet | **real** `apply_coins` ledger |
| Admin | open (demo) | **role-gated** (`profiles.role`) |

The **backend demo** stands up the whole thing on real Supabase with **mocked but
real-feeling** SMS and TeleBirr (genuine coin movements, no SMS gateway, no
merchant account): the OTP shows on screen, and checkout runs through the demo
TeleBirr page → real webhook. A seed script (`npm run seed`) fills a believable
roster, orders, tournaments and scores so the admin console looks live on day one.

→ Full runbook: **[DEMO_SETUP.md](DEMO_SETUP.md)**. Backend internals (schema,
Edge Functions, going live): **[supabase/README.md](supabase/README.md)**.

## Games

| Game             | Genre                                      | Mode        | Status      |
| ---------------- | ------------------------------------------ | ----------- | ----------- |
| **Orbit Blast**  | 99-balls aim-and-shoot blaster             | 🏆 Tournament | ✅ Playable |
| **Merge 2048**   | Slide-to-merge number puzzle               | Free        | ✅ Playable |
| **Temple Dash**  | 3-lane endless runner — dodge, jump, slide | Free        | ✅ Playable |
| **Metro Rush**   | Subway-style lane runner                   | Free        | ✅ Playable |
| **Candy Crunch** | Match-3 with cascades and level goals      | Free        | ✅ Playable |
| **Dot Link**     | Connect-the-dots flow puzzle               | Free        | ✅ Playable |
| **Brick Blitz**  | Breakout-style brick breaker               | Free        | ✅ Playable |
| **Fruit Slice**  | Swipe-to-slice arcade                      | Free        | ✅ Playable |
| **Sky Hopper**   | Vertical platform jumper                   | Free        | ✅ Playable |
| **Bubble Pop**   | Bubble shooter                             | Free        | ✅ Playable |


## Quick start

```bash
cd Games/innoarcade
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the hub. Temple Dash lives at
[http://localhost:5173/games/temple-dash/](http://localhost:5173/games/temple-dash/).

This runs the **offline/local** mode — fully playable with no backend. For the
**backend demo** (real Supabase, mocked SMS + TeleBirr, seeded data) follow
[DEMO_SETUP.md](DEMO_SETUP.md).

`npm run build` type-checks and produces a static `dist/` deployable to any
static host (multi-page Vite build, relative asset paths).

## Architecture

- **No game engine** — plain TypeScript + Canvas 2D. A small shared engine in
[src/engine](src/engine) provides the rAF game loop, unified
keyboard/swipe input, Web Audio synthesized SFX (no asset files), and
localStorage high scores.
- **Pseudo-3D** — runners project objects from a world distance `z` toward a
horizon vanishing point (`p = near / (near + z)`), the same trick the
Construct-built references use.
- **i18n** — [src/i18n](src/i18n) holds the EN/AM dictionaries; static text is
tagged with `data-i18n` attributes and swapped in place. Language choice
persists in localStorage.

## Adding a game

1. Create `games/<name>/index.html` and `src/games/<name>/{main.ts,game.ts,style.css}`.
2. Add the page to `rollupOptions.input` in [vite.config.ts](vite.config.ts).
3. Add EN + AM strings to [src/i18n/index.ts](src/i18n/index.ts).
4. Register it in [src/platform/catalog.ts](src/platform/catalog.ts) with its
   `mode` — the hub picks it up automatically. For a tournament game, call
   `submitScore()` on game-over (see [orbit-blast/main.ts](src/games/orbit-blast/main.ts)).

