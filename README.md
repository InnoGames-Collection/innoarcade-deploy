# InnoArcade

Free HTML5 arcade games — canvas-based action and puzzle games inspired by
classic mobile hits. Built by **InnoSphere Technologies** as part of the
InnoGames platform, alongside [InnoWords](../innowords) and [LexiQuest](../lexiquest).

Fully bilingual: **English / አማርኛ (Amharic)** — toggle on the hub or in any game.

## Games

### Phase 1

| Game | Genre | Status |
|------|-------|--------|
| **Temple Dash** | 3-lane endless runner — dodge, jump, slide | ✅ Playable |
| **Metro Rush** | Subway-style lane runner | 🔜 Planned |
| **Candy Crunch** | Match-3 with cascades and level goals | 🔜 Planned |
| **Dot Link** | Connect-the-dots flow puzzle | 🔜 Planned |

### Phase 2 (placeholders on the hub)

| Game | Genre |
|------|-------|
| **Brick Blitz** | Breakout-style brick breaker |
| **Fruit Slice** | Swipe-to-slice arcade |
| **Sky Hopper** | Vertical platform jumper |
| **Bubble Pop** | Bubble shooter |

## Quick start

```bash
cd Games/innoarcade
npm install
npm run dev
```

Open http://localhost:5173 — the hub. Temple Dash lives at
http://localhost:5173/games/temple-dash/.

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
4. Turn the game's "coming soon" card on the hub into a link.
