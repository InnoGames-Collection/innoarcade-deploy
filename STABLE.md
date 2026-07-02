# Stable game releases

Games tagged `stable` in `src/platform/catalog.ts` are **frozen**. Treat them as production reference implementations.

## EthioRunner (`temple-dash`) — stable v3

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/temple-dash/**`
- `games/temple-dash/**`
- `scripts/process-ethio-f-skins.mjs`
- `scripts/compress-runner-sprites.mjs`
- `src/games/temple-dash/skins/ethio_f/**`

**Includes:** WebP skin sprites, staged Kenney/skin asset load, menu-first boot, inline tournament panel, entry flow, game-over rank/leaderboard overlay.

**v3 changelog (vs v2):** WebP sprite compression (~90% smaller), Kenney-then-skin staged loading, menu visible before sprites finish.

## Memory Match (`memory-match`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/memory-match/**`
- `games/memory-match/**`

**Includes:** Hub-themed playfield (green cards, blue stats), light tournament menu shell, entry/attempt flow, timed scoring formula, game-over leaderboard, play-again card blink, compact mobile layout.

**v1 changelog:** Tournament UX aligned with EthioRunner patterns; hub visual theme; bottom whitespace trimmed.

**Other games** (e.g. Fruit Slice monthly) should **copy patterns** from these stable builds via shared modules (`gameTournamentPanel`, `tournamentEntry`, `game-shell.css`) — not by editing locked game code.

## Ethiopian Quiz (`ethiopian-quiz`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/ethiopian-quiz/**`
- `games/ethiopian-quiz/**`

**Includes:** 600-question bank wiring, public prompt cleanup, 10-question timed MCQ sessions, pause cost, cross-session dedup (via shared shell).

**v1 changelog:** Shared quiz shell integration; pause costs points; question dedup by prompt; immediate close via shared nav.

## Spell Trivia (`spell`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/spell/**`
- `games/spell/**`

**Includes:** Two-column spelling options, LexiQuest SPELL bank adapter, shared free-quiz shell.

**v1 changelog:** Shared quiz shell; close-button clearance and instant exit via shared platform CSS/nav.

## Shared code changes

Stable games **do** pick up fixes from shared platform code (`freeQuizShell.ts`, `freeShellNav.ts`, `_quiz/style.css`, `game-shell.css`, i18n). When editing those files, note in the PR/commit message which stable games are affected.
