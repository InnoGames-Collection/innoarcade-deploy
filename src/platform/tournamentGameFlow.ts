// Shared tournament flow for in-game shells — one path for all tournament games
// (coin modal entry, start-round, submit-score). Matches Memory Match model.

import { getLang, t } from '../i18n';
import { openTournamentEntryForGame } from '../hub/tournamentEntry';
import { promptIfSessionExpired } from './sessionAuth';
import { type GameHost, type FinishResult } from './gameHost';
import {
  renderShellMenuTournamentHtml, tournamentBoardHtml, type ShellMenuTournamentOpts,
} from './gameTournamentPanel';
import { balance } from './wallet';
import { leaderboardRemote, playerStandingRemote } from './backend';
import { isConfigured } from './supabase';
import { currentUser } from './auth';
import { loadTournaments, loadMyEntries, myEntry, getTournamentForGame } from './tournaments';
import { getGame } from './catalog';

export function tournamentAttemptsLeft(gameId: string): number {
  const tour = getTournamentForGame(gameId);
  return tour ? (myEntry(tour.id)?.left ?? 0) : 0;
}

export function tournamentPlayLabel(gameId: string): string {
  const left = tournamentAttemptsLeft(gameId);
  return left > 0 ? `▶ ${t('hub.play')} · 🎟️ ${left}` : t('hub.play');
}

export interface MenuPanelSnapshot {
  serverBest: number;
  attemptsLeft: number;
}

export async function refreshTournamentMenuPanel(
  gameId: string,
  mount: HTMLElement,
  opts?: ShellMenuTournamentOpts & { icon?: string },
): Promise<MenuPanelSnapshot | null> {
  if (!isConfigured()) {
    mount.innerHTML = '';
    return null;
  }
  await currentUser();
  await Promise.all([loadTournaments(), loadMyEntries()]);
  const tourney = getTournamentForGame(gameId);
  if (!tourney) {
    mount.innerHTML = '';
    return null;
  }
  const meta = getGame(gameId);
  const title = meta ? (getLang() === 'am' ? meta.nameAm : meta.nameEn) : gameId;
  const icon = opts?.icon ?? meta?.icon ?? '🎮';

  const [walletCoins, standing, board] = await Promise.all([
    balance(),
    playerStandingRemote(tourney.id),
    leaderboardRemote(tourney.id, 5),
  ]);
  const attemptsLeft = myEntry(tourney.id)?.left ?? 0;
  const serverBest = standing?.score ?? 0;

  mount.innerHTML = renderShellMenuTournamentHtml(
    title, icon, walletCoins, serverBest, attemptsLeft, board,
    { cadence: tourney.cadence, ...opts },
  );
  return { serverBest, attemptsLeft };
}

export function promptTournamentEntry(
  gameId: string,
  onRefresh: () => void,
  onPlay: () => void,
): void {
  openTournamentEntryForGame(gameId, { onEntered: onRefresh, onPlay });
}

export function applyTournamentPlayLabels(
  gameId: string,
  buttons: {
    start?: HTMLButtonElement | null;
    again?: HTMLButtonElement | null;
    restart?: HTMLButtonElement | null;
  },
): void {
  const playLabel = tournamentPlayLabel(gameId);
  const left = tournamentAttemptsLeft(gameId);
  if (buttons.start) {
    buttons.start.disabled = false;
    buttons.start.textContent = playLabel;
  }
  if (buttons.again) {
    buttons.again.disabled = false;
    buttons.again.textContent = playLabel;
  }
  if (buttons.restart) {
    buttons.restart.disabled = false;
    buttons.restart.textContent = left > 0 ? t('td.restart') : t('hub.play');
  }
}

export async function failRankedSubmit(
  reward: HTMLElement,
  showToast: (msg: string) => void,
  cssPrefix = 'shell-rr',
): Promise<void> {
  if (await promptIfSessionExpired(showToast)) {
    reward.innerHTML = `<span class="${cssPrefix}-note">${t('td.sessionExpired')}</span>`;
    return;
  }
  reward.innerHTML = `<span class="${cssPrefix}-note">${t('td.submitFailed')}</span>`;
  showToast(t('td.submitFailed'));
}

export interface SubmitRoundUi {
  rewardEl: HTMLElement;
  boardEl: HTMLElement;
  cssPrefix?: string;
  showToast: (msg: string) => void;
  onBest: (best: number, isRecord: boolean) => void;
  onSync?: () => void;
}

export async function submitTournamentRound(
  host: GameHost,
  gameId: string,
  score: number,
  win: boolean,
  durationMs: number,
  ranked: boolean,
  ui: SubmitRoundUi,
): Promise<FinishResult | null> {
  const prefix = ui.cssPrefix ?? 'shell-rr';
  if (!isConfigured()) {
    ui.rewardEl.innerHTML = '';
    ui.boardEl.innerHTML = '';
    ui.onBest(score, false);
    return null;
  }
  ui.rewardEl.innerHTML = `<span class="${prefix}-pending">…</span>`;
  const res = await host.finish(score, win, durationMs, { ranked });
  if (ranked && res.rank == null) {
    await failRankedSubmit(ui.rewardEl, ui.showToast, prefix);
    return null;
  }
  const best = res.best ?? 0;
  ui.onBest(best, res.isRecord ?? false);
  ui.rewardEl.innerHTML = `<span class="${prefix}-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
    <span class="${prefix}-stat"><b>${t('td.best')}</b> ${best.toLocaleString()}</span>`;
  if (typeof res.attemptsLeft === 'number') {
    ui.rewardEl.innerHTML += `<span class="${prefix}-stat">🎟️ ${t('td.attemptsLeft')}: <strong>${res.attemptsLeft}</strong></span>`;
  }
  const tour = getTournamentForGame(gameId);
  if (tour) {
    const [board, standing] = await Promise.all([
      leaderboardRemote(tour.id, 5),
      playerStandingRemote(tour.id),
    ]);
    ui.boardEl.innerHTML = tournamentBoardHtml(board, standing);
  }
  ui.onSync?.();
  return res;
}

/** Consume one attempt and issue a round token. Returns false on failure. */
export async function startTournamentRound(
  host: GameHost,
  showToast: (msg: string) => void,
): Promise<boolean> {
  try {
    await host.startRound();
    return true;
  } catch {
    if (!(await promptIfSessionExpired(showToast))) showToast(t('td.submitFailed'));
    return false;
  }
}
