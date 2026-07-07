// One-time first-run hints for new games (client-only, non-scoring).

import { t, type I18nKey } from '../../i18n';

const KEY = (gameId: string): string => `goplay.hint.${gameId}`;

/** i18n help text for a game (`lq.help.<id>`), with English fallback. */
export function firstRunMessage(gameId: string, fallbackEn: string): string {
  const key = `lq.help.${gameId}` as I18nKey;
  const msg = t(key);
  return msg === key ? fallbackEn : msg;
}

export function isFirstRun(gameId: string): boolean {
  try {
    return !localStorage.getItem(KEY(gameId));
  } catch {
    return false;
  }
}

export function markFirstRunSeen(gameId: string): void {
  try {
    localStorage.setItem(KEY(gameId), '1');
  } catch { /* storage unavailable */ }
}

/** Show a toast once per device for this game. */
export function showFirstRunToast(
  gameId: string,
  message: string,
  toastFn: (msg: string, ms?: number) => void,
  ms = 5000,
): void {
  if (!isFirstRun(gameId)) return;
  markFirstRunSeen(gameId);
  toastFn(message, ms);
}

/** First-run toast using `lq.help.<gameId>` (EN + AM). */
export function showFirstRunHint(
  gameId: string,
  toastFn: (msg: string, ms?: number) => void,
  fallbackEn?: string,
  ms = 5000,
): void {
  const message = firstRunMessage(gameId, fallbackEn ?? `Tap Play to start ${gameId}.`);
  showFirstRunToast(gameId, message, toastFn, ms);
}
