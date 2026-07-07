# New Games QA — Manual Smoke Scripts

Smoke-test each **new** title (not in `STABLE.md`). Run `npm run dev`, open the hub, and follow the steps. Pass = starts, core loop works, game over / win screen appears without console errors.

## Brain / LQ games

| Game | Levels | Smoke steps | Pass criteria |
|------|--------|-------------|---------------|
| **water-sort** | 8 | Pour between tubes; undo | All tubes single-color; 8 levels complete; first-run toast (EN/AM) |
| **parking-jam** | 8 | Slide cars to free the exit car | Exit car drives out; session win |
| **laser-puzzle** | 5 | Rotate mirrors; fire laser | Targets show shape glyphs; laser hits all; 5 puzzles |
| **tile-connect** | 5 | Match pairs with ≤2 bends | Hint button works; 5 boards clear |
| **hexa-block** | — | Place hex pieces | Ghost preview; line clears |
| **ball-sort** | 8 | Pour balls between tubes | Color-blind ball patterns; sorted win |
| **pipe-connect** | 5 | Tap pipes to rotate | Water-fill animation on solve |
| **slide-puzzle** | 5 | Slide tiles into order | Harder scrambles; 5 rounds |
| **jewel-match** | 3 | Swap jewels (targets 600 / 1400 / 2400) | Level targets before moves run out |
| **block-blast** | — | Place polyominoes | Line-clear flash; ghost preview |

## Canvas arcade

| Game | Smoke steps | Pass criteria |
|------|-------------|---------------|
| **piano-tiles** | Tap black tiles | White-tile penalty; first-run hint |
| **stack-tower** | Tap to drop blocks | Tightening perfect tolerance; juice |
| **crossy-road** | Swipe / tap to cross | In-game tutorial; idle death ~14s |
| **knife-hit** | Tap to throw knives | Apple +25; juice on stick/crash |
| **helix-jump** | Rotate helix | Smash streak + juice |
| **hill-climb** | Gas / brake | Fuel meter depletes |
| **tower-defense** | Place / upgrade towers | 15 waves |
| **draw-bridge** | Draw line; DRIVE | 5 levels; min stroke length |
| **reflex-tap** | Tap targets | 3 waves in 60s |
| **doodle-jump** | Steer to platforms | Score from height; juice on land |
| **zigzag** | Tap at corners | Path collision; tap bonus juice |
| **color-switch** | Tap to match colors | Shape glyphs on segments + ball |
| **rope-rescue** | Draw rope; SWING | Reach SAFE; juice |
| **ball-maze** | Steer through maze | 5 mazes |
| **arrow-shot** | Aim with wind | Moving targets |
| **race-car** | Change lanes | Coins + shield pickups |

## Phase 3 — Polish checks

- [ ] Hub cards show SVG cover art for all 26 new games
- [ ] ℹ️ How-to-play on hub cards is bespoke EN + AM (not generic fallback)
- [ ] First-run toast uses `lq.help.*` (switch language → Amharic hint)
- [ ] `document.addEventListener('goplay-game', …)` fires `runStart` / `gameOver` / `levelComplete`
- [ ] Mute persists across games (`sfx.muted` in localStorage)
- [ ] Color-blind: water-sort CSS patterns, ball-sort patterns, color-switch glyphs, laser target shapes
- [ ] Particle cap: heavy juice games stay smooth (max ~96 particles)
- [ ] `WIN_SCORE` aligned with level depth (e.g. jewel-match ≥ 2400)

## Shared platform checks

- [ ] `npm run build` passes
- [ ] `npm test` passes (solvable, pathCollision, levelGen, juice cap)
- [ ] Juice visible on: knife-hit, stack-tower, doodle-jump, zigzag
- [ ] tile-connect / slide-puzzle / pipe-connect use `_lq/solvable` + `levelGen`
- [ ] No edits under stable game folders (`STABLE.md` list)

## Regression spot-check

1. Open **tile-connect** — clear one pair; invalid path shows toast.
2. Open **slide-puzzle** — scramble is solvable; complete one board.
3. Open **pipe-connect** — rotate until connected; win sound.
4. Open **knife-hit** — 3 sticks + 1 collision; particles + shake.
5. Open **doodle-jump** — score starts at 0; land on platform.

## Skipped (multiplayer)

- **ludo**, **pool** — not implemented by design.
