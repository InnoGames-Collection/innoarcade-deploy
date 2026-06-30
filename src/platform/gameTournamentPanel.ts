// Shared in-game tournament panel — mirrors EthioRunner's #runnerTourney layout.
// Consumed by tournament games (memory-match, fruit-slice). EthioRunner keeps its
// inline stable-v1 copy; new games use this module.

import { getLang, t } from '../i18n';
import { leaderboardRemote, playerStandingRemote } from './backend';
import { balance } from './wallet';
import { isConfigured } from './supabase';
import { currentUser } from './auth';
import {
  getTournamentForGame, loadMyEntries, loadTournaments, myEntry,
  type LeaderEntry, type Tournament,
} from './tournaments';

export interface TournamentPanelSnapshot {
  tourney?: Tournament;
  walletCoins: number;
  serverBest: number;
  attemptsLeft: number;
  board: LeaderEntry[];
}

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function medal(rank: number): string {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;
}

/** Top-N rows ranked by raw score (runner parity — not RP). */
export function tournamentBoardHtml(rows: LeaderEntry[]): string {
  if (!rows.length) return `<p class="gt-empty">${t('td.noBoard')}</p>`;
  return rows.map((r) => `
    <div class="gt-row${r.isPlayer ? ' me' : ''}">
      <span class="gt-rank">${medal(r.rank)}</span>
      <span class="gt-name">${escHtml(r.isPlayer ? t('td.you') : r.name)}</span>
      <span class="gt-score">${r.score.toLocaleString()}</span>
    </div>`).join('');
}

export function renderTournamentPanelHtml(snap: TournamentPanelSnapshot): string {
  const tour = snap.tourney;
  if (!tour) return '';
  const title = getLang() === 'am' ? tour.titleAm : tour.titleEn;
  const left = snap.attemptsLeft;
  return `
    <div class="gt-head">
      <span class="gt-title">🏆 ${escHtml(title)}</span>
      <span class="gt-coins">${snap.walletCoins.toLocaleString()} 🪙</span>
    </div>
    <div class="gt-best">${t('td.yourBest')}: <strong>${snap.serverBest.toLocaleString()}</strong></div>
    ${left > 0 ? `<div class="gt-status"><span class="gt-attempts">🎟️ ${t('td.attemptsLeft')}: <strong>${left}</strong></span></div>` : ''}
    <div class="gt-board">${tournamentBoardHtml(snap.board)}</div>`;
}

/** Load tournament state from the server and paint the panel. Returns snapshot for callers. */
export async function refreshGameTournamentPanel(
  gameId: string,
  mount: HTMLElement,
  boardLimit = 5,
): Promise<TournamentPanelSnapshot | null> {
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

  const [walletCoins, standing, board] = await Promise.all([
    balance(),
    playerStandingRemote(tourney.id),
    leaderboardRemote(tourney.id, boardLimit),
  ]);
  const attemptsLeft = myEntry(tourney.id)?.left ?? 0;
  const snap: TournamentPanelSnapshot = {
    tourney,
    walletCoins,
    serverBest: standing?.score ?? 0,
    attemptsLeft,
    board,
  };
  mount.innerHTML = renderTournamentPanelHtml(snap);
  return snap;
}
