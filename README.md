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

- **Coin wallet** ([wallet.ts](src/platform/wallet.ts)) — balance + immutable
  ledger; a live coin chip and the player dashboard sit on the hub.
- **Coin store & payments** ([payments.ts](src/platform/payments.ts),
  [config.ts](src/platform/config.ts)) — buy coin packages via **TeleBirr** or
  **airtime top-up**. With no merchant keys it runs in **sandbox** (credits
  instantly) so the whole purchase journey demos offline; real TeleBirr drops in
  via the `buy-coins` / `payment-callback` functions.
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

