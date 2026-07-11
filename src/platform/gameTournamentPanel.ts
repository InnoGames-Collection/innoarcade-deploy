// Shared in-game tournament panel markup for tournament games.

import { t } from '../i18n';
import { type TournamentCadence } from './catalog';
import { type LeaderEntry } from './tournaments';

export interface ShellMenuTournamentOpts {
  cadence?: TournamentCadence;
  gameId?: string;
  /** Short scoring / rules line under the best-score row. */
  hint?: string;
  /** Hide the separate best row when the player already appears on the board. */
  hideBestIfOnBoard?: boolean;
  /** Player standing when not in the top-N board rows. */
  standing?: LeaderEntry | null;
}

function cadenceBadgeHtml(cadence: TournamentCadence): string {
  const label = t(
    cadence === 'daily' ? 'td.daily' : cadence === 'weekly' ? 'td.weekly' : 'td.monthly',
  );
  return `<span class="gt-cadence"><span class="gt-cadence-badge gt-cadence-${cadence}">${label}</span> · ${t('hub.tournament')}</span>`;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function medal(rank: number): string {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;
}

function boardRowHtml(r: LeaderEntry): string {
  return `
    <div class="gt-row${r.isPlayer ? ' me' : ''}">
      <span class="gt-rank">${medal(r.rank)}</span>
      <span class="gt-name">${escHtml(r.isPlayer ? t('td.you') : r.name)}</span>
      <span class="gt-score">${r.score.toLocaleString()}</span>
    </div>`;
}

/** Top-N rows from the server board (ranked by RP; cells show raw best). */
export function tournamentBoardHtml(rows: LeaderEntry[], standing?: LeaderEntry | null): string {
  const playerInBoard = rows.some((r) => r.isPlayer);
  if (!rows.length && !standing) return `<p class="gt-empty">${t('td.noBoard')}</p>`;
  let html = rows.map(boardRowHtml).join('');
  if (standing && !playerInBoard) {
    html += `<div class="gt-board-sep" aria-hidden="true"></div>${boardRowHtml(standing)}`;
  }
  return html || `<p class="gt-empty">${t('td.noBoard')}</p>`;
}

/** Menu tournament panel — game title, best, attempts, leaderboard. */
export function renderShellMenuTournamentHtml(
  gameTitle: string,
  gameIcon: string,
  _walletCoins: number,
  serverBest: number,
  attemptsLeft: number,
  board: LeaderEntry[],
  opts?: ShellMenuTournamentOpts,
): string {
  const cadenceRow = opts?.cadence ? cadenceBadgeHtml(opts.cadence) : '';
  const hintRow = opts?.hint
    ? `<div class="gt-hint">${escHtml(opts.hint)}</div>`
    : '';
  const playerOnBoard = board.some((r) => r.isPlayer);
  const bestRow = (opts?.hideBestIfOnBoard && playerOnBoard)
    ? ''
    : `<div class="gt-best">${t('td.yourBest')}: <strong>${serverBest.toLocaleString()}</strong></div>`;
  return `
    <div class="gt-head gt-head-inline">
      <span class="gt-game-icon" aria-hidden="true">${gameIcon}</span>
      <div class="gt-head-text">
        <span class="gt-title">${escHtml(gameTitle)}</span>
        ${cadenceRow}
      </div>
    </div>
    ${bestRow}
    ${hintRow}
    ${attemptsLeft > 0 ? `<div class="gt-status"><span class="gt-attempts">🎟️ ${t('td.attemptsLeft')}: <strong>${attemptsLeft}</strong></span></div>` : ''}
    <div class="gt-board">${tournamentBoardHtml(board, opts?.standing)}</div>`;
}
