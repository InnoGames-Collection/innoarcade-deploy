# Stable game releases

Games tagged `stable` in `src/platform/catalog.ts` are **frozen**. Treat them as production reference implementations.

## Locked games (current)

| Game | ID | Tag | Mode |
|------|-----|-----|------|
| Ethiorunner | `temple-dash` | v3 | Tournament (daily) |
| Memory Match | `memory-match` | v1 | Tournament (weekly) |
| Ethiopian Quiz | `ethiopian-quiz` | v1 | Free |
| Spell Trivia | `spell` | v1 | Free |
| 2048 | `merge-2048` | v1 | Free |

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

## Memory Match (`memory-match`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/memory-match/**`
- `games/memory-match/**`

**Includes:** Hub-themed playfield (green cards, blue stats), light tournament menu shell, entry/attempt flow, timed scoring formula, game-over leaderboard, play-again card blink, compact mobile layout, close-button clearance.

**v1 changelog:** Tournament UX aligned with EthioRunner patterns; hub visual theme; bottom whitespace trimmed.

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

## Shared code changes

Stable games **do** pick up fixes from shared platform code (`freeQuizShell.ts`, `freeGameShell.ts`, `freeShellNav.ts`, `_quiz/style.css`, `_casual/style.css`, `game-shell.css`, i18n). When editing those files, note which stable games are affected.

**Other games** (e.g. Fruit Slice monthly) should **copy patterns** from these stable builds via shared modules — not by editing locked game code.
