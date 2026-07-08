# New game branding checklist

Use this before merging any **new** catalog game. Stable games (`STABLE.md`) are frozen — do not edit their folders unless explicitly requested.

## Shell HTML (`games/<id>/index.html`)

- [ ] `<body class="game-shell …" data-game="<id>">` — correct variant:
  - **Arcade canvas:** `game-shell arcade-shell` + `#arc-play-wrapper` + `.arc-canvas-wrap`
  - **Casual / fc-stage:** `game-shell casual-shell` + `#fcPlayFrame`
  - **Brain / LQ:** `game-shell casual-shell brain-shell` + `#lq-mount`
  - **Quiz:** `game-shell quiz-shell`
- [ ] Standard overlays: `#menuOverlay`, pause (if applicable), `#overOverlay`
- [ ] **No** inline `onclick="history.back()"` on close buttons — wired in TS via `wireFreeEngineMain` / `wireFreeCasualShell` / `mountLQ`
- [ ] `shell-boot` CSS is injected at build time (Vite plugin) — no manual link needed

## CSS imports (`src/games/<id>/main.ts`)

| Shell type | Import recipe |
|------------|---------------|
| Arcade canvas | `base.css` → `game-shell.css` → `_casual/style.css` → `_arcade/hubCanvas.css` → `./style.css` |
| Brain / LQ | `base.css` → `game-shell.css` → `_casual/style.css` → `_lq/lq.css` → `./style.css` |
| Casual fc-stage | `base.css` → `game-shell.css` → `_casual/style.css` → `./style.css` |
| Quiz | `base.css` → `game-shell.css` → `_quiz/style.css` → `./style.css` |

## Per-game `style.css` (new games only)

- [ ] Light shell stays light — dark backgrounds only **inside** the playfield (board, canvas, lanes)
- [ ] Selection / progress / highlights use `var(--game-accent)` (set from catalog via `gameTheme.ts`)
- [ ] Do not redefine shell chrome tokens (`--shell-*`, `--grad-brand`) — use platform CSS

## Catalog (`src/platform/catalog.ts`)

- [ ] `accent`, `thumb: [a, b]`, `cover` (WebP in `/public`, e.g. `water_sort.webp`)
- [ ] `category`, `mode`, route, i18n names
- [ ] **Not** tagged `stable` until signed off

## Generate cover art

**Placeholder gradients** (fast, no illustration):

```bash
npm run covers:generate
```

**Custom illustration** (recommended for production):

1. Generate a **4:3** PNG in polished mobile-game style (see `assets/covers/README.md` for prompts).
2. Save source to `assets/covers/<slug>.png`.
3. Import optimized WebP:

```bash
npm run covers:import -- assets/covers/water_sort.png water-sort
```

Regenerating placeholders overwrites WebP files — re-import custom art after running `covers:generate`.

## Verify

```bash
npm run lint:games
npm run build
```

Smoke-test: hub card → menu → play → pause → close/back to hub (no console errors).

## Reference stable games

| Shell | Reference |
|-------|-----------|
| Arcade canvas | `bubble-pop`, `orbit-blast` |
| Casual fc-stage | `tap-game`, `lucky-box` |
| Brain / LQ | `sudoku`, `sequence` |
| Quiz | `ethiopian-quiz` |

See also `STABLE.md` for locked production titles.
