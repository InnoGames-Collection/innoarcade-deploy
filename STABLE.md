# Stable game releases

Games tagged `stable` in `src/platform/catalog.ts` are **frozen**. Treat them as production reference implementations.

## EthioRunner (`temple-dash`) — stable v1

**Status:** Locked. Do not modify unless explicitly requested.

**Scope (frozen):**

- `src/games/temple-dash/**`
- `games/temple-dash/**`

**Includes:** canvas runner, skins, tournament panel (`#runnerTourney`), entry flow, game-over overlay, inline tournament wiring in `main.ts`.

**Other games** (e.g. Memory Match weekly, Fruit Slice monthly) should **copy patterns** from EthioRunner via new shared modules or game-specific code — not by editing EthioRunner.
