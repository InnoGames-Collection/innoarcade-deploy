# Stable game releases

Games tagged `stable` in `src/platform/catalog.ts` are **frozen**. Treat them as production reference implementations.

## Locked games (current)

All titles below are locked at their listed tag. **Do not edit game-specific folders** unless explicitly requested. New games are added as separate entries — existing stable games are never modified.

| Game | ID | Tag | Mode |
|------|-----|-----|------|
| Ethiorunner | `temple-dash` | v3 | Free |
| Ball Shooter | `orbit-blast` | v2 | Free |
| 2048 | `merge-2048` | v1 | Free |
| Candy Saga | `candy-crunch` | v1 | Free (hidden) |
| Brick Blitz | `brick-blitz` | v1 | Free |
| Fruit Slice | `fruit-slice` | v1 | Tournament (weekly) |
| Crossy Road | `crossy-road` | v1 | Free |
| Helix Jump | `helix-jump` | v1 | Free |
| Sky Hopper | `sky-hopper` | v1 | Free |
| Bubble Pop (Bubble Shooter) | `bubble-pop` | v1 | Free |
| Memory Match | `memory-match` | v1 | Tournament (monthly) |
| Tap Game | `tap-game` | v1 | Free |
| Lucky Boxes | `lucky-box` | v1 | Free |
| Spin Wheel | `spin-wheel` | v1 | Free |
| Lucky Slot | `luckyslot` | v1 | Free |
| Candy Blast | `popblast` | v1 | Free |
| Ethiopian Quiz | `ethiopian-quiz` | v1 | Free |
| Sudoku | `sudoku` | v1 | Free |
| Spell Trivia | `spell` | v1 | Free |
| Vocabulary | `vocab` | v1 | Free |
| Rhyme Time | `rhyme` | v1 | Free |
| Target 24 | `target24` | v1 | Free |
| Cross Sum | `crosssum` | v1 | Free |
| Logic Grid | `logic` | v1 | Free |
| Sequence | `sequence` | v1 | Free |

**Policy:** Do not edit game-specific folders unless explicitly requested. Shared platform changes may affect stable games — document those in commits/PRs.

---

## EthioRunner (`temple-dash`) — stable v3

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/temple-dash/**`
- `games/temple-dash/**`
- `scripts/process-ethio-f-skins.mjs`
- `scripts/compress-runner-sprites.mjs`
- `src/games/temple-dash/skins/ethio_f/**`

**Includes:** WebP skin sprites, staged Kenney/skin asset load, menu-first boot, inline tournament panel, entry flow, game-over rank/leaderboard overlay, pause play-again, mobile HUD layout.

**v3 changelog (vs v2):** WebP sprite compression (~90% smaller), Kenney-then-skin staged loading, menu visible before sprites finish.

---

## Fruit Slice (`fruit-slice`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/fruit-slice/**`
- `games/fruit-slice/**`

**Includes:** Slice physics, bomb avoidance, score/combo, tournament weekly flow, canvas rendering (fruits, bombs, particles, lighting).

---

## Crossy Road (`crossy-road`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/crossy-road/**`
- `games/crossy-road/**`

**Includes:** Isometric runner, lane crossing, collision, distance scoring, premium/legacy renderer modes, audio.

---

## Helix Jump (`helix-jump`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/helix-jump/**`
- `games/helix-jump/**`

**Includes:** Tower generation, ball physics, rotation controls, depth scoring, skins, effects, audio.

---

## Memory Match (`memory-match`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/memory-match/**`
- `games/memory-match/**`
- `assets/memory-match/**`
- `scripts/*memory-match*`

**Includes:** Hub-themed playfield (blue card backs, green stage backdrop), tournament menu shell, entry/attempt flow, timed scoring formula, game-over overlay (time, rank, best, attempts, rewards, leaderboard), play-again/home actions, compact mobile layout, premium card icons, SFX/VFX hooks.

**v1 changelog:** Tournament UX aligned with EthioRunner patterns; hub visual theme; game-over overlay restored; attempts sync with tournament panel.

---

## Ethiopian Quiz (`ethiopian-quiz`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/ethiopian-quiz/**`
- `games/ethiopian-quiz/**`

**Includes:** 600-question bank wiring, public prompt cleanup, 10-question timed MCQ sessions, pause cost, cross-session dedup (via shared shell).

**v1 changelog:** Shared quiz shell integration; pause costs points; question dedup by prompt; immediate close via shared nav.

---

## Spell Trivia (`spell`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/spell/**`
- `games/spell/**`

**Includes:** Two-column spelling options, LexiQuest SPELL bank adapter, shared free-quiz shell.

**v1 changelog:** Shared quiz shell; close-button clearance and instant exit via shared platform CSS/nav.

---

## 2048 (`merge-2048`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/merge-2048/**`
- `games/merge-2048/**`

**Includes:** Hub-themed Memory Match frame, score/best header, mute + pause controls, pause overlay (resume / play again), slide-merge puzzle logic.

**v1 changelog:** Memory Match-style play card; visible close button; working pause/resume/restart flow.

---

## Ball Shooter (`orbit-blast`) — stable v2

**Status:** Locked. Do not modify unless explicitly authorized by the user.

**Scope (frozen):**

- `src/games/orbit-blast/**`
- `games/orbit-blast/**`

**Includes:** 99-Balls-style aim-and-shoot gameplay (volley launch, wall ricochet, numbered blocks, descending rows), premium Ethio Telecom presentation (blue-green arcade background, glossy balls/blocks/shooter, particle effects, combo visuals, glass HUD, premium menus/game-over screen), `obAudio.ts` arcade SFX + generative music bed, animated score counters.

**Gameplay frozen:** Ball shooting mechanics, ball physics, collision logic, level progression, difficulty, target spawning, game rules, backend, and tournament integration must not change without user authorization.

**v2 changelog:** Premium commercial-quality visual/audio/UX polish pass; Ethio Telecom green/blue/white theme; visual combo system and floating score popups; redesigned start/pause/game-over screens and HUD.

---

## Bubble Pop (`bubble-pop`) — stable v1

**Status:** Locked. Do not modify unless explicitly authorized by the user.

**Scope (frozen):**

- `src/games/bubble-pop/**`
- `games/bubble-pop/**`

**Includes:** Pointer-aim bubble shooter with match-3 clears, premium canvas rendering (`bpRender.ts`), effects (`bpEffects.ts`), arcade SFX (`bpAudio.ts`), hub-themed shell and HUD.

**Gameplay frozen:** Bubble launch physics, matching/clearing logic, grid layout, scoring rules, level progression, and difficulty must not change without user authorization.

**v1 changelog:** Premium bubble-shooter presentation with float text, combo banners, impact particles, and Ethio Telecom–aligned playfield chrome.

---

## Brick Blitz (`brick-blitz`) — stable v1

**Status:** Locked. Do not modify unless explicitly authorized by the user.

**Scope (frozen):**

- `src/games/brick-blitz/**`
- `games/brick-blitz/**`

**Includes:** Breakout gameplay (paddle physics, ball dynamics, brick HP, power-ups, 5-level progression), premium Ethio Telecom presentation (glossy ball/paddle/bricks, particle effects, combo visuals, glass HUD, premium menus/game-over screen), `bbAudio.ts` arcade SFX, animated score counters.

**Gameplay frozen:** Ball physics, paddle movement, collision logic, brick breaking logic, power-up logic, game progression, levels, and difficulty must not change without user authorization.

**v1 changelog:** Premium commercial-quality visual/audio polish pass; Ethio Telecom green/blue/white theme; combo system (visual only); floating score popups; redesigned start/pause/game-over screens.

---

## Candy Blast (`popblast`) — stable v1

**Status:** Locked. Do not modify unless explicitly authorized by the user.

**Scope (frozen):**

- `src/games/popblast/**`
- `games/popblast/**`

**Includes:** 8×8 DOM match-3 with hub casual shell, premium Ethio Telecom presentation (blue-green gradient background, light rays, sparkles, floating bubbles, glossy candy tiles, elevated board frame), glass HUD (`hud.ts`) with animated score/target/moves/level/best counters, floating score popups and combo celebrations (`fx.ts`), particle effects, screen shake, victory/game-over screens with stars and fireworks, premium synthesized audio (`audio.ts`), start menu with hub navigation links.

**Gameplay frozen:** Match detection, candy movement, physics, game logic, level progression, difficulty, power-up mechanics, backend, and tournament integration must not change without user authorization.

**v1 changelog:** Premium commercial-quality visual/audio/UX polish pass; Ethio Telecom green/blue/white theme; combo celebration system (visual only); floating score feedback; redesigned start/pause/victory/game-over screens and HUD.

---

## All other stable v1 games

The remaining titles in the table above (`candy-crunch`, `sky-hopper`, `tap-game`, `lucky-box`, `spin-wheel`, `luckyslot`, `sudoku`, `vocab`, `rhyme`, `target24`, `crosssum`, `logic`, `sequence`) are locked at **v1** as of the Phase 1 expansion. Each game's scope is its `src/games/<id>/**` and `games/<id>/**` folders.

---

## Shared code changes

Stable games **do** pick up fixes from shared platform code (`freeQuizShell.ts`, `freeGameShell.ts`, `freeShellNav.ts`, `_quiz/style.css`, `_casual/style.css`, `game-shell.css`, i18n). When editing those files, note which stable games are affected.

**New games** (e.g. Water Sort and subsequent Phase 1 titles) should **copy patterns** from these stable builds via shared modules — not by editing locked game code.
