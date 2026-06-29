// Unified tournament entry: one modal for balance, buy coins, and confirmed entry.

import { t, getLang } from '../i18n';
import { maskPhone } from '../platform/phone';
import { normalizePhone } from '../platform/auth';
import { openSignIn } from './signin';
import { needsSignInToBuy, openInlineCoinCheckout, coinPackagesForEntry } from './wallet';
import { balanceSync, balance } from '../platform/wallet';
import {
  enterTournament, isPaid, isEntered, myEntry, getTournamentForGame,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { getGame, type GameMeta } from '../platform/catalog';
import { SignInRequiredError } from '../platform/payments';

export interface TournamentEntryOptions {
  tour: Tournament;
  game?: GameMeta;
  onEntered?: () => void;
  /** Navigate to the game page (hub). */
  playHref?: string;
  /** Start playing in-place (already on the game page). */
  onPlay?: () => void;
}

export interface EntryCallbacks {
  onEntered?: () => void;
  onPlay?: () => void;
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function titleOf(tour: Tournament): string {
  return getLang() === 'am' ? tour.titleAm : tour.titleEn;
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

function showSuccess(
  m: HTMLElement,
  opts: { onEntered?: () => void; playHref?: string; onPlay?: () => void },
): void {
  const card = m.querySelector('.entry-card')!;
  card.innerHTML = `
    <div class="entry-joined">
      <div class="ej-burst">✅</div>
      <h3>${t('hub.joined')}</h3>
      <button type="button" class="btn primary" id="playNow">${t('hub.playNow')}</button>
    </div>`;
  card.querySelector('#playNow')!.addEventListener('click', () => {
    m.remove();
    if (opts.onPlay) opts.onPlay();
    else if (opts.playHref) window.location.assign(opts.playHref);
  });
  opts.onEntered?.();
}

/** Open the combined enter / buy-coins modal for a tournament window. */
export function openTournamentEntry(opts: TournamentEntryOptions): void {
  const { tour, game, onEntered, playHref, onPlay } = opts;
  const meta = game ?? getGame(tour.gameId);

  if (isPaid(tour) && needsSignInToBuy()) {
    const m = entryShell(`
      <h3>🏆 ${esc(titleOf(tour))}</h3>
      <p class="entry-notice">${t('hub.signInToEnter')}</p>
      <div class="entry-actions">
        <button type="button" class="btn primary" id="signin">${t('hub.register')}</button>
        <button type="button" class="btn ghost" id="cancel">${t('hub.cancel')}</button>
      </div>`);
    m.querySelector('#signin')!.addEventListener('click', () => { m.remove(); openSignIn(); });
    m.querySelector('#cancel')!.addEventListener('click', () => m.remove());
    return;
  }

  const left = myEntry(tour.id)?.left ?? 0;
  if (isEntered(tour.id) && left > 0) {
    onEntered?.();
    if (onPlay) onPlay();
    else if (playHref) window.location.assign(playHref);
    return;
  }

  const gameName = meta ? (getLang() === 'am' ? meta.nameAm : meta.nameEn) : '';
  const m = entryShell(`
    <h3>🏆 ${esc(titleOf(tour))}</h3>
    ${gameName ? `<p class="entry-game">${esc(gameName)}</p>` : ''}
    <div class="entry-balance" id="balanceRow"></div>
    <p class="entry-summary" id="summary"></p>
    <p class="entry-notice" id="feeNotice"></p>
    <div class="entry-buy" id="buySection" hidden></div>
    <p class="entry-err" id="err"></p>
    <div class="entry-actions" id="actions"></div>`);

  renderEntryBody(m, tour, { onEntered, playHref, onPlay });
}

function renderEntryBody(
  m: HTMLElement,
  tour: Tournament,
  opts: { onEntered?: () => void; playHref?: string; onPlay?: () => void },
): void {
  const fee = tour.entryFeeCoins;
  const attempts = tour.attempts;
  const bal = balanceSync();
  const afford = bal >= fee;

  m.querySelector('#balanceRow')!.innerHTML =
    `<span>${t('hub.yourBalance')}</span><strong>${bal.toLocaleString()} 🪙</strong>`;

  m.querySelector('#summary')!.textContent =
    t('hub.entrySummary').replace('{fee}', String(fee)).replace('{attempts}', String(attempts));

  m.querySelector('#feeNotice')!.textContent = afford
    ? t('hub.entryJoinHint').replace('{fee}', String(fee))
    : t('hub.needCoinsShort').replace('{fee}', String(fee));

  const buySection = m.querySelector<HTMLElement>('#buySection')!;
  const actions = m.querySelector('#actions')!;

  if (!afford) {
    buySection.hidden = false;
    buySection.innerHTML =
      `<p class="entry-buy-title">${t('hub.buyCoinsToPlay')}</p><div class="entry-pkg-grid" id="pkgGrid"></div>`;
    const pkgs = coinPackagesForEntry(fee);
    const grid = buySection.querySelector('#pkgGrid')!;
    grid.innerHTML = pkgs.map((p) => {
      const total = p.coins + p.bonus;
      return `<button type="button" class="entry-pkg" data-id="${p.id}">
        <span class="ep-coins">🪙 ${total.toLocaleString()}</span>
        <span class="ep-price">${p.priceEtb} ETB</span>
      </button>`;
    }).join('');
    grid.querySelectorAll<HTMLButtonElement>('.entry-pkg').forEach((b) => {
      b.addEventListener('click', () => {
        const pkg = pkgs.find((p) => p.id === b.dataset.id);
        if (!pkg) return;
        openInlineCoinCheckout(pkg, m, async () => {
          await balance();
          renderEntryBody(m, tour, opts);
        });
      });
    });
    actions.innerHTML = `
      <button type="button" class="btn primary" id="confirm" disabled>${t('hub.enterTournament')} · ${fee} 🪙</button>
      <button type="button" class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
  } else {
    buySection.hidden = true;
    actions.innerHTML = `
      <button type="button" class="btn primary" id="confirm">${t('hub.enterTournament')} · ${fee} 🪙</button>
      <button type="button" class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
    actions.querySelector<HTMLButtonElement>('#confirm')!.addEventListener('click', async () => {
      const btn = actions.querySelector<HTMLButtonElement>('#confirm')!;
      btn.disabled = true;
      btn.textContent = t('hub.joining');
      try {
        await enterTournament(tour.id);
        showSuccess(m, opts);
      } catch (e) {
        if (e instanceof SignInRequiredError) { m.remove(); openSignIn(); return; }
        if (e instanceof InsufficientCoinsError) {
          await balance();
          renderEntryBody(m, tour, opts);
          return;
        }
        m.querySelector('#err')!.textContent = t('hub.entryFailed');
        btn.disabled = false;
        btn.textContent = `${t('hub.enterTournament')} · ${fee} 🪙`;
      }
    });
  }
  actions.querySelector('#cancel')?.addEventListener('click', () => m.remove());
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
    .entry-game { color:#5f7262; font-size:.85rem; margin:0; }
    .entry-balance { display:flex; justify-content:space-between; align-items:center;
      background:#f3fbe9; border:1px solid #d4ebc0; border-radius:12px; padding:10px 14px; font-weight:700; }
    .entry-summary { font-size:.92rem; font-weight:700; margin:0; text-align:center; color:#14271a; }
    .entry-notice { font-size:.82rem; color:#5f7262; margin:0; line-height:1.45; text-align:center; }
    .entry-err { font-size:.8rem; color:#d64545; min-height:1em; margin:0; text-align:center; }
    .entry-actions { display:flex; flex-direction:column; gap:8px; }
    .entry-buy { border-top:1px solid #e6efdc; padding-top:10px; }
    .entry-buy-title { font-size:.88rem; font-weight:800; color:#9a6b12; margin:0 0 8px; text-align:center; }
    .entry-pkg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:8px; }
    .entry-pkg { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 6px;
      border:1px solid #e6efdc; border-radius:12px; background:#fff; cursor:pointer; font:inherit; }
    .entry-pkg:hover { border-color:#4f9e16; box-shadow:0 4px 12px rgba(79,158,22,.15); }
    .ep-coins { font-weight:900; font-size:.95rem; color:#7a5212; }
    .ep-price { font-size:.72rem; font-weight:700; color:#5f7262; }
    .entry-joined { text-align:center; display:flex; flex-direction:column; gap:12px; align-items:center; padding:12px 4px; }
    .entry-joined h3 { color:#14271a; font-size:1.2rem; }
    .ej-burst { font-size:3rem; line-height:1; }
    .btn { display:inline-flex; align-items:center; justify-content:center; width:100%;
      padding:.7rem 1rem; border-radius:10px; font:inherit; font-weight:700; cursor:pointer;
      text-decoration:none; border:1px solid transparent; box-sizing:border-box; }
    .btn.primary { background:linear-gradient(135deg,#2f8fe6,#1f5fc4); color:#fff; border:none; }
    .btn.primary:disabled { opacity:.45; cursor:not-allowed; }
    .btn.ghost { background:transparent; border:1px solid #e6efdc; color:#5f7262; }`;
  document.head.appendChild(s);
}

export function defaultDisplayName(phone: string): string {
  return maskPhone(normalizePhone(phone));
}
