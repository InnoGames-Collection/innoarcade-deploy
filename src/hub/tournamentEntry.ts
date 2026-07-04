// Tournament entry: spend earned coins for attempts (no buying).

import { t } from '../i18n';
import { openSignIn } from './signin';
import { balanceSync, balance } from '../platform/wallet';
import {
  enterTournament, isPaid, isEntered, myEntry, getTournamentForGame,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { getGame, type GameMeta } from '../platform/catalog';
import { SignInRequiredError } from '../platform/payments';
import { economyNeedsAuth } from '../platform/config';

export interface TournamentEntryOptions {
  tour: Tournament;
  game?: GameMeta;
  onEntered?: () => void;
  playHref?: string;
  onPlay?: () => void;
}

export interface EntryCallbacks {
  onEntered?: () => void;
  onPlay?: () => void;
}

function injectStyles(): void {
  if (document.getElementById('entry-modal-styles')) return;
  const s = document.createElement('style');
  s.id = 'entry-modal-styles';
  s.textContent = `
    .entry-modal { position:fixed; inset:0; z-index:9991; display:flex; align-items:center; justify-content:center; }
    .entry-scrim { position:absolute; inset:0; background:rgba(12,16,30,.5); backdrop-filter:blur(3px); }
    .entry-card { position:relative; width:min(360px,92vw); max-height:90vh; overflow:auto;
      background:#fff; color:#14271a; border-radius:16px; padding:22px;
      box-shadow:0 20px 50px rgba(20,30,60,.3); display:flex; flex-direction:column; gap:10px; }
    .entry-card h3 { font-size:1.15rem; margin:0; color:#14271a; font-weight:800; }
    .entry-summary { font-size:.95rem; font-weight:800; margin:0; text-align:center; color:#14271a; }
    .entry-notice { font-size:.82rem; color:#5f7262; margin:0; line-height:1.45; text-align:center; }
    .entry-err { font-size:.8rem; color:#d64545; min-height:1em; margin:0; text-align:center; }
    .entry-actions { display:flex; gap:8px; }
    .entry-actions-row { flex-direction:row; }
    .entry-actions-row .btn { flex:1; min-width:0; }
    .entry-bal { text-align:center; font-size:.85rem; color:#5f7262; margin:0; }
    .entry-bal strong { color:#7a5212; }
    .entry-joined { text-align:center; display:flex; flex-direction:column; gap:12px; align-items:center; padding:12px 4px; }
    .entry-joined h3 { color:#14271a; font-size:1.2rem; margin:0; }
    .ej-burst { font-size:3rem; line-height:1; }
    .btn { display:inline-flex; align-items:center; justify-content:center; width:100%;
      padding:.7rem 1rem; border-radius:10px; font:inherit; font-weight:700; cursor:pointer;
      text-decoration:none; border:1px solid transparent; box-sizing:border-box; }
    .btn.primary { background:linear-gradient(135deg,#2f8fe6,#1f5fc4); color:#fff; border:none; }
    .btn.primary:disabled { opacity:.45; cursor:not-allowed; }
    .btn.ghost { background:transparent; border:1px solid #e6efdc; color:#5f7262; }`;
  document.head.appendChild(s);
}

function entryShell(inner: string): HTMLElement {
  injectStyles();
  document.querySelector('.entry-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'entry-modal';
  m.innerHTML = `<div class="entry-scrim"></div><div class="entry-card">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.entry-scrim')!.addEventListener('click', () => m.remove());
  return m;
}

function showJoinedSuccess(
  entryModal: HTMLElement,
  opts: { onEntered?: () => void; playHref?: string; onPlay?: () => void },
): void {
  entryModal.remove();
  injectStyles();
  const m = document.createElement('div');
  m.className = 'entry-modal entry-modal-joined';
  m.innerHTML = `
    <div class="entry-scrim"></div>
    <div class="entry-card">
      <div class="entry-joined">
        <div class="ej-burst">✅</div>
        <h3>${t('hub.joined')}</h3>
        <button type="button" class="btn primary" id="playNow">${t('hub.playNow')}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('.entry-scrim')!.addEventListener('click', () => m.remove());
  m.querySelector('#playNow')!.addEventListener('click', () => {
    m.remove();
    opts.onEntered?.();
    if (opts.onPlay) opts.onPlay();
    else if (opts.playHref) window.location.assign(opts.playHref);
  });
}

/** Open the combined enter / earn-coins modal for a tournament window. */
export function openTournamentEntry(opts: TournamentEntryOptions): void {
  const { tour, onEntered, playHref, onPlay } = opts;

  if (isPaid(tour) && economyNeedsAuth()) {
    openSignIn();
    return;
  }

  const left = myEntry(tour.id)?.left ?? 0;
  if (isEntered(tour.id) && left > 0) {
    onEntered?.();
    if (onPlay) onPlay();
    else if (playHref) window.location.assign(playHref);
    return;
  }

  const m = entryShell('');
  void balance().then(() => renderEntryBody(m, tour, { onEntered, playHref, onPlay }));
}

function renderEntryBody(
  m: HTMLElement,
  tour: Tournament,
  opts: { onEntered?: () => void; playHref?: string; onPlay?: () => void },
): void {
  const fee = tour.entryFeeCoins;
  const bal = balanceSync();
  const afford = bal >= fee;
  const card = m.querySelector('.entry-card')!;
  const attempts = tour.attempts ?? 10;

  if (afford) {
    const msg = t('hub.spendForAttempts').replace('{fee}', String(fee)).replace('{n}', String(attempts));
    card.innerHTML = `
      <p class="entry-summary">${msg}</p>
      <p class="entry-bal">🪙 ${bal.toLocaleString()}</p>
      <p class="entry-err" id="err"></p>
      <div class="entry-actions entry-actions-row">
        <button type="button" class="btn primary" id="confirm">${t('hub.ok')}</button>
        <button type="button" class="btn ghost" id="cancel">${t('hub.cancel')}</button>
      </div>`;

    card.querySelector<HTMLButtonElement>('#confirm')!.addEventListener('click', async () => {
      const btn = card.querySelector<HTMLButtonElement>('#confirm')!;
      btn.disabled = true;
      try {
        await enterTournament(tour.id);
        showJoinedSuccess(m, opts);
      } catch (e) {
        if (e instanceof SignInRequiredError) { m.remove(); openSignIn(); return; }
        if (e instanceof InsufficientCoinsError) {
          await balance();
          renderEntryBody(m, tour, opts);
          return;
        }
        card.querySelector('#err')!.textContent = t('hub.entryFailed');
        btn.disabled = false;
      }
    });
  } else {
    const msg = t('hub.notEnoughEarned').replace('{fee}', String(fee));
    card.innerHTML = `
      <p class="entry-summary">${msg}</p>
      <p class="entry-bal">🪙 ${bal.toLocaleString()}</p>
      <div class="entry-actions entry-actions-row">
        <button type="button" class="btn ghost" id="cancel">${t('hub.ok')}</button>
      </div>`;
  }

  card.querySelector('#cancel')?.addEventListener('click', () => m.remove());
}

/** Open entry modal for a game id. Pass `onPlay` when already on the game page. */
export function openTournamentEntryForGame(
  gameId: string,
  cb?: EntryCallbacks | (() => void),
): void {
  const tour = getTournamentForGame(gameId);
  if (!tour) return;
  const game = getGame(gameId);
  const callbacks: EntryCallbacks = typeof cb === 'function' ? { onEntered: cb } : (cb ?? {});
  openTournamentEntry({
    tour,
    game,
    onEntered: callbacks.onEntered,
    onPlay: callbacks.onPlay,
    playHref: callbacks.onPlay ? undefined : game?.route,
  });
}
