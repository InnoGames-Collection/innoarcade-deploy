// Unified tournament entry: buy coins, pay, and confirmed entry.

import { t, needCoinToPlayMessage } from '../i18n';
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

/** Close the entry modal, then open a fresh success mini-window (not stacked on the entry card). */
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

function actionRow(confirmHtml: string): string {
  return `<div class="entry-actions entry-actions-row">
    ${confirmHtml}
    <button type="button" class="btn ghost" id="cancel">${t('hub.cancel')}</button>
  </div>`;
}

async function tryEnterAfterPurchase(
  m: HTMLElement,
  tour: Tournament,
  opts: { onEntered?: () => void; playHref?: string; onPlay?: () => void },
): Promise<void> {
  await balance();
  if (balanceSync() < tour.entryFeeCoins) {
    renderEntryBody(m, tour, opts);
    return;
  }
  try {
    await enterTournament(tour.id);
    showJoinedSuccess(m, opts);
  } catch (e) {
    if (e instanceof SignInRequiredError) { m.remove(); openSignIn(); return; }
    if (e instanceof InsufficientCoinsError) {
      renderEntryBody(m, tour, opts);
      return;
    }
    renderEntryBody(m, tour, opts);
    m.querySelector('#err')!.textContent = t('hub.entryFailed');
  }
}

/** Open the combined enter / buy-coins modal for a tournament window. */
export function openTournamentEntry(opts: TournamentEntryOptions): void {
  const { tour, onEntered, playHref, onPlay } = opts;

  if (isPaid(tour) && needsSignInToBuy()) {
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

  if (!afford) {
    const pkgs = coinPackagesForEntry(fee);
    let selectedId = pkgs[0]?.id ?? '';
    card.innerHTML = `
      <div class="entry-buy">
        <p class="entry-buy-title">${t('hub.buyCoinsToPlay')}</p>
        <div class="entry-pkg-grid" id="pkgGrid">${pkgs.map((p) => {
          const total = p.coins + p.bonus;
          const sel = p.id === selectedId ? ' sel' : '';
          return `<button type="button" class="entry-pkg${sel}" data-id="${p.id}">
            <span class="ep-coins">🪙 ${total.toLocaleString()}</span>
            <span class="ep-price">${p.priceEtb} ETB</span>
          </button>`;
        }).join('')}</div>
      </div>
      <p class="entry-err" id="err"></p>
      ${actionRow(`<button type="button" class="btn primary" id="confirm"${selectedId ? '' : ' disabled'}>${t('hub.ok')}</button>`)}`;

    const confirmBtn = card.querySelector<HTMLButtonElement>('#confirm')!;

    const syncSelection = (id: string): void => {
      selectedId = id;
      card.querySelectorAll<HTMLButtonElement>('.entry-pkg').forEach((b) => {
        b.classList.toggle('sel', b.dataset.id === id);
      });
      confirmBtn.disabled = !id;
    };

    card.querySelectorAll<HTMLButtonElement>('.entry-pkg').forEach((b) => {
      b.addEventListener('click', () => syncSelection(b.dataset.id ?? ''));
    });

    confirmBtn.addEventListener('click', () => {
      const pkg = pkgs.find((p) => p.id === selectedId);
      if (!pkg) return;
      openInlineCoinCheckout(pkg, m, {
        onBack: () => renderEntryBody(m, tour, opts),
        onPaid: () => tryEnterAfterPurchase(m, tour, opts),
      });
    });
  } else {
    card.innerHTML = `
      <p class="entry-summary">${esc(needCoinToPlayMessage(fee))}</p>
      <p class="entry-err" id="err"></p>
      ${actionRow(`<button type="button" class="btn primary" id="confirm">${t('hub.ok')}</button>`)}`;

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
    .entry-buy-title { font-size:.88rem; font-weight:800; color:#9a6b12; margin:0 0 8px; text-align:center; }
    .entry-pkg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:8px; }
    .entry-pkg { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 6px;
      border:1px solid #e6efdc; border-radius:12px; background:#fff; cursor:pointer; font:inherit; }
    .entry-pkg:hover { border-color:#4f9e16; box-shadow:0 4px 12px rgba(79,158,22,.15); }
    .entry-pkg.sel { border-color:#2f8fe6; box-shadow:0 0 0 2px rgba(47,143,230,.25); background:#f4f9ff; }
    .ep-coins { font-weight:900; font-size:.95rem; color:#7a5212; }
    .ep-price { font-size:.72rem; font-weight:700; color:#5f7262; }
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

export function defaultDisplayName(phone: string): string {
  return maskPhone(normalizePhone(phone));
}
