// Unified tournament entry: one modal for fee breakdown, balance, buy coins,
// and confirmed entry. Used by the hub and tournament game pages.

import { t, getLang } from '../i18n';
import { maskPhone } from '../platform/phone';
import { normalizePhone } from '../platform/auth';
import { openSignIn } from './signin';
import { needsSignInToBuy, openInlineCoinCheckout, coinPackagesForEntry } from './wallet';
import { balanceSync, balance } from '../platform/wallet';
import {
  enterTournament, prizePool, isPaid, isEntered, myEntry, getTournamentForGame,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { getGame, type GameMeta } from '../platform/catalog';
import { SignInRequiredError } from '../platform/payments';

export interface TournamentEntryOptions {
  tour: Tournament;
  game?: GameMeta;
  /** Called after a successful paid entry (coins deducted). */
  onEntered?: () => void;
  /** If set, show a Play button instead of only closing. */
  playHref?: string;
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

/** Open the combined enter / buy-coins modal for a tournament window. */
export function openTournamentEntry(opts: TournamentEntryOptions): void {
  const { tour, game, onEntered, playHref } = opts;
  const meta = game ?? getGame(tour.gameId);

  if (isPaid(tour) && needsSignInToBuy()) {
    const m = entryShell(`
      <h3>🏆 ${esc(titleOf(tour))}</h3>
      <p class="entry-notice">${t('hub.signInToEnter')}</p>
      <div class="entry-actions">
        <button class="btn primary" id="signin">${t('hub.register')}</button>
        <button class="btn ghost" id="cancel">${t('hub.cancel')}</button>
      </div>`);
    m.querySelector('#signin')!.addEventListener('click', () => { m.remove(); openSignIn(); });
    m.querySelector('#cancel')!.addEventListener('click', () => m.remove());
    return;
  }

  // Already entered with attempts left — no charge.
  const left = myEntry(tour.id)?.left ?? 0;
  if (isEntered(tour.id) && left > 0) {
    onEntered?.();
    return;
  }

  const fee = tour.entryFeeCoins;
  const gameName = meta ? (getLang() === 'am' ? meta.nameAm : meta.nameEn) : '';
  const split = (tour.prizeTiers ?? []).map((s) =>
    `<span class="split-chip">#${s.rank} · ${s.pct}%</span>`).join('');

  const m = entryShell(`
    <h3>🏆 ${esc(titleOf(tour))}</h3>
    ${gameName ? `<p class="entry-game">${esc(gameName)}</p>` : ''}
    <div class="entry-balance" id="balanceRow"></div>
    <div class="entry-rows">
      <div class="entry-row"><span>${t('hub.entry')}</span><strong>${fee} 🪙</strong></div>
      <div class="entry-row"><span>${t('hub.attemptsPerEntry')}</span><strong>${tour.attempts}</strong></div>
      <div class="entry-row"><span>${t('hub.pool')}</span><strong>${prizePool(tour).toLocaleString()} 🪙</strong></div>
    </div>
    <div class="entry-split"><span class="split-label">${t('hub.prizeSplit')}</span>${split}</div>
    <p class="entry-notice" id="feeNotice"></p>
    <div class="entry-buy" id="buySection" hidden></div>
    <p class="entry-err" id="err"></p>
    <div class="entry-actions" id="actions"></div>`);

  renderEntryBody(m, tour, { onEntered, playHref });
}

function renderEntryBody(
  m: HTMLElement,
  tour: Tournament,
  opts: { onEntered?: () => void; playHref?: string },
): void {
  const fee = tour.entryFeeCoins;
  const bal = balanceSync();
  const afford = bal >= fee;

  const balRow = m.querySelector('#balanceRow')!;
  balRow.innerHTML = `<span>${t('hub.yourBalance')}</span><strong>${bal.toLocaleString()} 🪙</strong>`;

  const notice = m.querySelector('#feeNotice')!;
  notice.textContent = afford
    ? t('hub.coinsWillBeDeducted').replace('{n}', String(fee))
    : t('hub.needCoinsToPlay').replace('{n}', String(fee)).replace('{bal}', String(bal));

  const buySection = m.querySelector<HTMLElement>('#buySection')!;
  const actions = m.querySelector('#actions')!;

  if (!afford) {
    buySection.hidden = false;
    buySection.innerHTML = `<p class="entry-buy-title">${t('hub.buyCoinsToPlay')}</p><div class="entry-pkg-grid" id="pkgGrid"></div>`;
    const grid = buySection.querySelector('#pkgGrid')!;
    const pkgs = coinPackagesForEntry(fee);
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
    actions.innerHTML = `<button class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
  } else {
    buySection.hidden = true;
    actions.innerHTML = `
      <button class="btn primary" id="confirm">${t('hub.enterTournament')} · ${fee} 🪙</button>
      <button class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
    actions.querySelector<HTMLButtonElement>('#confirm')!.addEventListener('click', async () => {
      const btn = actions.querySelector<HTMLButtonElement>('#confirm')!;
      btn.disabled = true;
      btn.textContent = t('hub.joining');
      try {
        const entry = await enterTournament(tour.id);
        const card = m.querySelector('.entry-card')!;
        card.innerHTML = `
          <div class="entry-joined">
            <div class="ej-burst">✅</div>
            <h3>${t('hub.joined')}</h3>
            <p class="entry-notice">${t('hub.coinsDeducted').replace('{n}', String(fee))}</p>
            <p class="entry-notice">${t('hub.attemptsLeftNow').replace('{n}', String(entry.left))}</p>
            ${opts.playHref
              ? `<a class="btn primary" href="${opts.playHref}">${t('hub.playNow')}</a>`
              : `<button class="btn primary" id="done">${t('hub.cancel')}</button>`}
          </div>`;
        if (!opts.playHref) card.querySelector('#done')!.addEventListener('click', () => m.remove());
        opts.onEntered?.();
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

/** Convenience: open entry modal for a game id (daily/weekly/monthly tournament). */
export function openTournamentEntryForGame(gameId: string, onEntered?: () => void): void {
  const tour = getTournamentForGame(gameId);
  if (!tour) return;
  const game = getGame(gameId);
  openTournamentEntry({ tour, game, onEntered, playHref: game?.route });
}

function injectStyles(): void {
  if (document.getElementById('entry-modal-styles')) return;
  const s = document.createElement('style');
  s.id = 'entry-modal-styles';
  s.textContent = `
    .entry-modal { position:fixed; inset:0; z-index:9991; display:flex; align-items:center; justify-content:center; }
    .entry-scrim { position:absolute; inset:0; background:rgba(12,16,30,.5); backdrop-filter:blur(3px); }
    .entry-card { position:relative; width:min(400px,92vw); max-height:90vh; overflow:auto;
      background:#fff; color:var(--text,#14271a); border-radius:16px; padding:22px;
      box-shadow:0 20px 50px rgba(20,30,60,.3); display:flex; flex-direction:column; gap:10px; }
    .entry-card h3 { font-size:1.15rem; margin:0; }
    .entry-game { color:var(--muted,#5f7262); font-size:.85rem; margin:0; }
    .entry-balance { display:flex; justify-content:space-between; align-items:center;
      background:#f3fbe9; border:1px solid #d4ebc0; border-radius:12px; padding:10px 14px; font-weight:700; }
    .entry-rows { display:flex; flex-direction:column; gap:6px; background:#f6f7fb; border-radius:12px; padding:12px 14px; }
    .entry-row { display:flex; justify-content:space-between; font-size:.9rem; color:var(--muted,#5f7262); }
    .entry-row strong { color:var(--text,#14271a); }
    .entry-split { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
    .split-label { font-size:.78rem; color:var(--muted,#5f7262); margin-right:4px; }
    .split-chip { font-size:.72rem; font-weight:700; background:rgba(79,158,22,.12); color:#4f9e16;
      padding:.1rem .5rem; border-radius:999px; }
    .entry-notice { font-size:.78rem; color:var(--muted,#5f7262); margin:0; line-height:1.45; }
    .entry-err { font-size:.8rem; color:#d64545; min-height:1em; margin:0; }
    .entry-actions { display:flex; flex-direction:column; gap:8px; }
    .entry-buy { border-top:1px solid #e6efdc; padding-top:10px; }
    .entry-buy-title { font-size:.88rem; font-weight:800; color:#9a6b12; margin:0 0 8px; text-align:center; }
    .entry-pkg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:8px; }
    .entry-pkg { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 6px;
      border:1px solid #e6efdc; border-radius:12px; background:#fff; cursor:pointer; font:inherit; }
    .entry-pkg:hover { border-color:#4f9e16; box-shadow:0 4px 12px rgba(79,158,22,.15); }
    .ep-coins { font-weight:900; font-size:.95rem; color:#7a5212; }
    .ep-price { font-size:.72rem; font-weight:700; color:var(--muted,#5f7262); }
    .entry-joined { text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center; padding:8px; }
    .ej-burst { font-size:3rem; }
    .btn { display:inline-flex; align-items:center; justify-content:center; padding:.65rem 1rem;
      border-radius:10px; font:inherit; font-weight:700; cursor:pointer; text-decoration:none; border:1px solid transparent; }
    .btn.primary { background:linear-gradient(135deg,#2f8fe6,#1f5fc4); color:#fff; border:none; }
    .btn.primary:disabled { opacity:.6; cursor:default; }
    .btn.ghost { background:transparent; border:1px solid #e6efdc; color:var(--muted,#5f7262); }`;
  document.head.appendChild(s);
}

/** Default public display name from the signed-in phone. */
export function defaultDisplayName(phone: string): string {
  return maskPhone(normalizePhone(phone));
}
