// Catalog-driven in-game theming — sets CSS custom properties on the game shell
// without editing per-game folders or duplicating accents in game-shell.css.

import { getGame } from './catalog';

/** Apply hub-aligned accent + thumb gradient tokens for a catalog game id. */
export function applyGameTheme(gameId: string): void {
  const meta = getGame(gameId);
  const body = document.body;
  if (!meta || !body) return;

  body.style.setProperty('--game-accent', meta.accent);
  body.style.setProperty('--lq-accent', meta.accent);
  if (meta.thumb?.length === 2) {
    body.style.setProperty('--game-thumb-a', meta.thumb[0]);
    body.style.setProperty('--game-thumb-b', meta.thumb[1]);
  }
}

/** Read `data-game` from the page shell (set in each game index.html). */
export function applyGameThemeFromPage(): void {
  const id = document.body?.dataset?.game
    ?? document.querySelector<HTMLElement>('[data-game]')?.dataset?.game;
  if (id) applyGameTheme(id);
}
