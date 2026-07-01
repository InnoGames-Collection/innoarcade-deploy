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
