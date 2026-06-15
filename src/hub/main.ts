import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../i18n';
import { mountSignIn, openSignIn } from './signin';
import { openAccount } from './account';
import { mountWallet, openStore, needsSignInToBuy } from './wallet';
import { onAuthChange, currentUser, signOut } from '../platform/auth';
import { sfx } from '../engine/audio';
import { renderDashboard, injectDashboardStyles } from './dashboard';
import { mergedLeaderboard } from '../platform/backend';
import { CATALOG, type GameMeta } from '../platform/catalog';
import {
  activeTournaments, featuredTournament, tournamentGame, leaderboard,
  playerStanding, countdown, loadTournaments, loadMyEntries,
  tournamentState, isPaid, isEntered, enterTournament, prizePool,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { balanceSync, onWalletChange } from '../platform/wallet';
import { SignInRequiredError } from '../platform/payments';
import { activeDraws, myTickets, enterDraw, recentWinners, NotEnoughPointsError } from '../platform/draws';
import { points as pointsBal, gold as goldBal, onCurrencyChange, earn } from '../platform/currency';
import { isTestMode, setTestMode } from '../platform/testMode';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const lang = (): Lang => getLang();
const name = (g: GameMeta): string => (lang() === 'am' ? g.nameAm : g.nameEn);
const genre = (g: GameMeta): string => (lang() === 'am' ? g.genreAm : g.genreEn);
const tTitle = (x: Tournament): string => (lang() === 'am' ? x.titleAm : x.titleEn);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function thumbStyle(g: GameMeta): string {
  return `background:linear-gradient(145deg, ${g.thumb[0]}, ${g.thumb[1]});`;
}

// --- Promo banner carousel --------------------------------------------------
const PROMOS = [
  { en: 'Win weekly & monthly prizes', am: 'ሳምንታዊ እና ወርሃዊ ሽልማቶችን ያሸንፉ', icon: '🎁', grad: ['#2f8fe6', '#1f5fc4'] },
  { en: 'Enter tournaments — climb the leaderboard', am: 'ውድድሮችን ይቀላቀሉ — ደረጃ ይውጡ', icon: '🏆', grad: ['#62c12e', '#3f9e16'] },
  { en: 'Play Lucky games for instant rewards', am: 'ለፈጣን ሽልማት ዕድል ጨዋታዎችን ይጫወቱ', icon: '🍀', grad: ['#f0a832', '#d8761b'] },
];
let promoIdx = 0;
function renderPromo(): void {
  const track = document.querySelector('#promoTrack');
  const dots = document.querySelector('#promoDots');
  if (!track || !dots) return;
  const p = PROMOS[promoIdx];
  track.innerHTML = `<div class="promo-slide" style="background:linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})">${p.icon} ${escapeHtml(lang() === 'am' ? p.am : p.en)}</div>`;
  dots.innerHTML = PROMOS.map((_, i) => `<span class="promo-dot${i === promoIdx ? ' on' : ''}"></span>`).join('');
}
function advancePromo(): void { promoIdx = (promoIdx + 1) % PROMOS.length; renderPromo(); }

// --- Compact balance pill strip (in the topbar) ------------------------------
function renderMyStats(): void {
  const host = document.querySelector('#topBalances');
  if (!host) return;
  const chip = (icon: string, val: string, cls: string): string =>
    `<span class="bal-chip ${cls}">${icon} <strong>${val}</strong></span>`;
  host.innerHTML =
    chip('🪙', balanceSync().toLocaleString(), 'bal-coins') +
    chip('⭐', pointsBal().toLocaleString(), 'bal-points') +
    chip('👑', goldBal().toLocaleString(), 'bal-gold');
}

// --- Tournament entry economy (CTA + confirm flow) --------------------------

const STATE_LABEL: Record<string, () => string> = {
  upcoming: () => t('hub.upcoming'), live: () => t('hub.live'),
  ended: () => t('hub.ended'), settling: () => t('hub.ended'), settled: () => t('hub.settled'),
};

// The card's primary action, reflecting state / paid / entered.
function entryCta(tour: Tournament, game: GameMeta, cls: string): string {
  const state = tournamentState(tour);
  const playable = state === 'live' || state === 'upcoming';
  if (!playable) return `<span class="btn disabled ${cls}">${STATE_LABEL[state]?.() ?? ''}</span>`;
  if (!isPaid(tour) || isEntered(tour.id)) {
    return `<a class="btn primary ${cls}" href="${game.route}" data-play="${tour.id}">${t('hub.playNow')}</a>`;
  }
  return `<button class="btn primary ${cls}" data-enter="${tour.id}">${t('hub.register')} · ${tour.entryFeeCoins} 🪙</button>`;
}

// Small free/fee + pool badges for a tournament card.
function economyBadges(tour: Tournament): string {
  const fee = isPaid(tour)
    ? `<span class="econ-badge fee">${t('hub.entry')}: ${tour.entryFeeCoins} 🪙</span>`
    : `<span class="econ-badge free">${t('hub.freeEntry')}</span>`;
  return `${fee}<span class="econ-badge pool">${t('hub.pool')}: ${prizePool(tour).toLocaleString()} 🪙</span>`;
}

// Attach handlers to register buttons / play links inside a freshly-rendered root.
function wireEntryCtas(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) => {
    b.addEventListener('click', () => {
      const tour = activeTournaments().find((x) => x.id === b.dataset.enter);
      const game = tour ? tournamentGame(tour) : undefined;
      if (tour && game) openEntryModal(tour, game);
    });
  });
  // Free / already-entered play links also record an entry so they show on the
  // dashboard (idempotent; navigation proceeds normally).
  document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => {
    a.addEventListener('click', () => { void enterTournament(a.dataset.play!).catch(() => {}); });
  });
}

function entryModal(inner: string): HTMLElement {
  document.querySelector('.entry-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'entry-modal';
  m.innerHTML = `<div class="entry-scrim"></div><div class="entry-card">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.entry-scrim')!.addEventListener('click', () => m.remove());
  return m;
}

function openEntryModal(tour: Tournament, game: GameMeta): void {
  // Paid entry requires an account when a backend is configured.
  if (isPaid(tour) && needsSignInToBuy()) {
    const m = entryModal(`
      <h3>🏆 ${escapeHtml(tTitle(tour))}</h3>
      <p class="entry-notice">${t('hub.feeNotice')}</p>
      <div class="entry-actions">
        <button class="btn primary" id="signin">${t('hub.register')}</button>
        <button class="btn ghost" id="cancel">${t('hub.cancel')}</button>
      </div>`);
    m.querySelector('#signin')!.addEventListener('click', () => { m.remove(); openSignIn(); });
    m.querySelector('#cancel')!.addEventListener('click', () => m.remove());
    return;
  }
  const fee = tour.entryFeeCoins;
  const gameName = lang() === 'am' ? game.nameAm : game.nameEn;
  const split = (tour.prizeTiers ?? []).map((s) =>
    `<span class="split-chip">#${s.rank} · ${s.pct}%</span>`).join('');
  const m = entryModal(`
    <h3>🏆 ${escapeHtml(tTitle(tour))}</h3>
    <p class="entry-game">${escapeHtml(gameName)}</p>
    <div class="entry-rows">
      <div class="entry-row"><span>${t('hub.entry')}</span><strong>${fee} 🪙</strong></div>
      <div class="entry-row"><span>${t('hub.pool')}</span><strong>${prizePool(tour).toLocaleString()} 🪙</strong></div>
    </div>
    <div class="entry-split"><span class="split-label">${t('hub.prizeSplit')}</span>${split}</div>
    <p class="entry-notice">${t('hub.feeNotice')}</p>
    <p class="entry-err" id="err"></p>
    <div class="entry-actions" id="actions"></div>`);
  renderEntryActions(m, tour, game);
}

function renderEntryActions(m: HTMLElement, tour: Tournament, game: GameMeta): void {
  const actions = m.querySelector('#actions')!;
  const afford = balanceSync() >= tour.entryFeeCoins;
  if (!afford) {
    actions.innerHTML = `
      <p class="entry-need">${t('hub.needCoins')}</p>
      <button class="btn primary" id="buy">${t('hub.buyCoins')}</button>
      <button class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
    actions.querySelector('#buy')!.addEventListener('click', () => { m.remove(); openStore(); });
  } else {
    actions.innerHTML = `
      <button class="btn primary" id="confirm">${t('hub.confirm')} · ${tour.entryFeeCoins} 🪙</button>
      <button class="btn ghost" id="cancel">${t('hub.cancel')}</button>`;
    actions.querySelector('#confirm')!.addEventListener('click', async () => {
      const btn = actions.querySelector<HTMLButtonElement>('#confirm')!;
      btn.disabled = true;
      try {
        await enterTournament(tour.id);
        m.querySelector('.entry-card')!.innerHTML = `
          <div class="entry-joined">
            <div class="ej-burst">✅</div>
            <h3>${t('hub.joined')}</h3>
            <a class="btn primary" href="${game.route}">${t('hub.playNow')}</a>
          </div>`;
        renderAll();
        void renderDashboard();
      } catch (e) {
        if (e instanceof SignInRequiredError) { m.remove(); openSignIn(); return; }
        if (e instanceof InsufficientCoinsError) { renderEntryActions(m, tour, game); return; }
        m.querySelector('#err')!.textContent = t('hub.entryFailed');
        btn.disabled = false;
      }
    });
  }
  actions.querySelector('#cancel')!.addEventListener('click', () => m.remove());
}

// --- Featured tournament hero ----------------------------------------------
function renderFeatured(): void {
  const host = $('#featured');
  const tour = featuredTournament();
  const game = tour ? tournamentGame(tour) : undefined;
  if (!tour || !game) { host.innerHTML = ''; return; }
  const top3 = leaderboard(tour.id, 3);
  const me = playerStanding(tour.id);

  host.innerHTML = `
    <article class="featured-card" style="${thumbStyle(game)}">
      <div class="fc-info">
        <span class="fc-badge">🏆 ${escapeHtml(tTitle(tour))}</span>
        <h3 class="fc-title">${escapeHtml(name(game))}</h3>
        <p class="fc-genre">${escapeHtml(genre(game))}</p>
        <div class="fc-meta">
          <div class="fc-countdown" id="fcCountdown"></div>
          <div class="fc-prize">${t('hub.prize')}: <strong>${tour.prizeCoins.toLocaleString()}</strong> ${t('hub.coins')} 🪙</div>
        </div>
        <div class="fc-econ">${economyBadges(tour)}</div>
        ${entryCta(tour, game, 'fc-cta')}
      </div>
      <div class="fc-board">
        <div class="fc-board-head">${t('hub.leaderboard')}</div>
        <ol class="leader-list">
          ${top3.map((r) => `
            <li class="leader-row${r.isPlayer ? ' me' : ''}">
              <span class="lr-rank">${r.rank}</span>
              <span class="lr-name">${escapeHtml(r.name)}</span>
              <span class="lr-score">${r.score.toLocaleString()}</span>
            </li>`).join('')}
        </ol>
        <div class="fc-yourrank">
          ${me
            ? `${t('hub.yourRank')}: <strong>#${me.rank}</strong>`
            : `<span class="muted-small">${t('hub.unranked')}</span>`}
        </div>
      </div>
      <div class="fc-glyph">${game.icon}</div>
    </article>`;
}

// After the instant (seed) render, blend in real Supabase scores and patch the
// featured leaderboard + your-rank in place. No-ops offline / before any real
// scores exist, so the seed field stays visible.
async function refreshFeatured(): Promise<void> {
  const tour = featuredTournament();
  if (!tour) return;
  const board = await mergedLeaderboard(tour.id);
  if (!board.length) return;
  const list = document.querySelector('#featured .leader-list');
  if (list) {
    list.innerHTML = board.slice(0, 3).map((r) => `
      <li class="leader-row${r.isPlayer ? ' me' : ''}">
        <span class="lr-rank">${r.rank}</span>
        <span class="lr-name">${escapeHtml(r.name)}</span>
        <span class="lr-score">${r.score.toLocaleString()}</span>
      </li>`).join('');
  }
  const me = board.find((e) => e.isPlayer);
  const yr = document.querySelector('#featured .fc-yourrank');
  if (yr) {
    yr.innerHTML = me
      ? `${t('hub.yourRank')}: <strong>#${me.rank}</strong>`
      : `<span class="muted-small">${t('hub.unranked')}</span>`;
  }
}

// --- Stats strip (platform KPIs — shown above the games list) ---------------
function renderStats(): void {
  const host = document.querySelector('#statsStrip');
  if (!host) return;
  const tours = activeTournaments();
  const live = tours.filter((x) => tournamentState(x) === 'live').length;
  const pool = tours.reduce((s, x) => s + prizePool(x), 0);
  const players = 12_480; // community size shown on the storefront
  const stat = (icon: string, value: string, label: string): string =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  host.innerHTML = [
    stat('🎮', String(CATALOG.length), t('hub.statGames')),
    stat('🏆', String(live), t('hub.statLive')),
    stat('🪙', pool.toLocaleString(), t('hub.pool')),
    stat('👥', players.toLocaleString(), t('hub.statPlayers')),
  ].join('');
}

// --- Tournament cards -------------------------------------------------------
function renderTournaments(): void {
  const host = $('#tournamentList');
  const tours = activeTournaments();
  host.innerHTML = tours.map((tour) => {
    const game = tournamentGame(tour);
    if (!game) return '';
    return `
      <article class="tour-card">
        <div class="tc-thumb" style="${thumbStyle(game)}"><span>${game.icon}</span></div>
        <div class="tc-body">
          <span class="live-dot">● ${STATE_LABEL[tournamentState(tour)]?.() ?? t('hub.live')}</span>
          <h4>${escapeHtml(tTitle(tour))}</h4>
          <p class="tc-game">${escapeHtml(name(game))}</p>
          <div class="tc-econ">${economyBadges(tour)}</div>
          <div class="tc-count" data-ends="${tour.endsAt}"></div>
        </div>
        ${entryCta(tour, game, 'tc-cta')}
      </article>`;
  }).join('');
  wireEntryCtas();
}

// --- Games grid, grouped into category rows ---------------------------------
// Curated shelf labels (EN/AM) + the order categories appear in. Derived from
// the catalog genre's first token; unknown keys fall back to the raw key and
// sort to the end.
const CAT_LABEL: Record<string, { en: string; am: string }> = {
  Chance: { en: 'Lucky & casino', am: 'ዕድል እና ካዚኖ' },
  Arcade: { en: 'Arcade', am: 'አርኬድ' },
  Puzzle: { en: 'Puzzle', am: 'እንቆቅልሽ' },
  'Match-3': { en: 'Match 3', am: 'ሦስት አዛምድ' },
  Runner: { en: 'Runner', am: 'ሩጫ' },
  Shooter: { en: 'Shooter', am: 'ተኳሽ' },
};
const CAT_ORDER = ['Chance', 'Arcade', 'Puzzle', 'Match-3', 'Runner', 'Shooter'];
function catKey(g: GameMeta): string { return g.genreEn.split('·')[0].trim(); }
function catLabel(key: string): string {
  const l = CAT_LABEL[key];
  return l ? (lang() === 'am' ? l.am : l.en) : key;
}

function gameCard(g: GameMeta): string {
  return `
    <a class="game-card" href="${g.route}">
      <div class="gc-thumb">
        <span class="gc-glyph">${g.icon}</span>
        ${g.mode === 'tournament' ? `<span class="gc-tag">🏆 ${t('hub.tournament')}</span>` : ''}
      </div>
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p>${escapeHtml(genre(g))}</p>
      </div>
    </a>`;
}

// Browse state for the games section (segmented filter + search).
let gameFilter: 'all' | 'tournament' | 'free' = 'tournament';
let gameQuery = '';

function renderGames(): void {
  const host = $('#gameGrid');
  const q = gameQuery.trim().toLowerCase();
  const pool = CATALOG.filter((g) => {
    if (gameFilter !== 'all' && g.mode !== gameFilter) return false;
    if (q && !`${g.nameEn} ${g.nameAm} ${g.genreEn}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (!pool.length) {
    host.innerHTML = `<p class="cat-empty">${t('hub.noResults')}</p>`;
    return;
  }
  const cats = new Map<string, GameMeta[]>();
  for (const g of pool) {
    const k = catKey(g);
    if (!cats.has(k)) cats.set(k, []);
    cats.get(k)!.push(g);
  }
  const keys = [...cats.keys()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a);
    const ib = CAT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  host.innerHTML = keys.map((key) => {
    const list = cats.get(key)!;
    return `
    <div class="cat-block">
      <div class="cat-head"><h3>${escapeHtml(catLabel(key))}<span class="cat-count">${list.length}</span></h3></div>
      <div class="cat-shelf">${list.map(gameCard).join('')}</div>
    </div>`;
  }).join('');
}

// --- LexiQuest brain-games category (links into the LexiQuest app) -----------
interface BrainGame { id: string; nameEn: string; nameAm: string; icon: string; thumb: [string, string]; }
const LEXIQUEST: BrainGame[] = [
  { id: 'spell', nameEn: 'Spell It', nameAm: 'ፊደል ቃላት', icon: '🔤', thumb: ['#6a4cff', '#34238f'] },
  { id: 'vocab', nameEn: 'Vocabulary', nameAm: 'መዝገበ ቃላት', icon: '📖', thumb: ['#2aa9d6', '#13627e'] },
  { id: 'rhyme', nameEn: 'Rhyme Time', nameAm: 'ግጥም', icon: '🎵', thumb: ['#e25aa0', '#8e2c63'] },
  { id: 'sudoku', nameEn: 'Sudoku', nameAm: 'ሱዶኩ', icon: '🔢', thumb: ['#34b38a', '#176049'] },
  { id: 'target24', nameEn: 'Target 24', nameAm: 'ኢላማ 24', icon: '🎯', thumb: ['#f0a832', '#9c6310'] },
  { id: 'crosssum', nameEn: 'Cross Sum', nameAm: 'ድምር', icon: '➕', thumb: ['#5b8cff', '#27468f'] },
  { id: 'logic', nameEn: 'Logic Grid', nameAm: 'ሎጂክ', icon: '🧩', thumb: ['#ff7a59', '#a83b22'] },
  { id: 'sequence', nameEn: 'Sequence', nameAm: 'ቅደም ተከተል', icon: '🔗', thumb: ['#7a6cff', '#3d2f9e'] },
];
function renderBrain(): void {
  const host = $('#brainGrid');
  host.innerHTML = LEXIQUEST.map((g) => `
    <a class="game-card" href="../lexiquest/#/g/${g.id}">
      <div class="gc-thumb">
        <span class="gc-glyph">${g.icon}</span>
      </div>
      <div class="gc-body"><h4>${escapeHtml(lang() === 'am' ? g.nameAm : g.nameEn)}</h4></div>
    </a>`).join('');
}

// --- Draws / lottery --------------------------------------------------------
function renderDraws(): void {
  const host = document.querySelector('#drawList');
  if (!host) return;
  const draws = activeDraws();
  host.innerHTML = draws.map((d) => {
    const tickets = myTickets(d.id);
    const afford = pointsBal() >= d.ticketCostPoints;
    return `
      <article class="draw-card draw-${d.period}">
        <div class="dc-top">
          <span class="dc-period">${escapeHtml(lang() === 'am' ? d.titleAm : d.titleEn)}</span>
          <span class="dc-prize">${d.prizeEtb.toLocaleString()} ETB</span>
        </div>
        <div class="dc-count" data-ends="${d.endsAt}"></div>
        <div class="dc-foot">
          <span class="dc-tickets">🎟️ ${t('hub.yourTickets')}: <strong>${tickets}</strong></span>
          <button class="btn primary dc-enter${afford ? '' : ' disabled'}" data-draw="${d.id}">${t('hub.enterDraw')} · ${d.ticketCostPoints} ⭐</button>
        </div>
      </article>`;
  }).join('');
  host.querySelectorAll<HTMLButtonElement>('.dc-enter').forEach((b) => {
    b.addEventListener('click', () => {
      const d = draws.find((x) => x.id === b.dataset.draw);
      if (!d) return;
      try { enterDraw(d); renderDraws(); }
      catch (e) {
        if (e instanceof NotEnoughPointsError) { b.textContent = t('hub.needPoints'); b.classList.add('disabled'); }
      }
    });
  });
}

function renderWinners(): void {
  const host = document.querySelector('#winnerList');
  if (!host) return;
  host.innerHTML = recentWinners().map((w) => `
    <div class="winner-row">
      <span class="wr-ico">🎉</span>
      <span class="wr-phone">${escapeHtml(w.phone)}</span>
      <span class="wr-prize">${w.prizeEtb.toLocaleString()} ETB</span>
    </div>`).join('');
}

// --- Live countdowns --------------------------------------------------------
const dShort = (): string => (lang() === 'am' ? 'ቀ' : 'd');
const hShort = (): string => (lang() === 'am' ? 'ሰ' : 'h');
const mShort = (): string => (lang() === 'am' ? 'ደ' : 'm');
const sShort = (): string => (lang() === 'am' ? 'ሰ' : 's');

function fmt(end: number): string {
  const c = countdown(end);
  if (c.done) return '—';
  if (c.days > 0) return `${c.days}${dShort()} ${c.hours}${hShort()} ${c.minutes}${mShort()}`;
  return `${c.hours}${hShort()} ${c.minutes}${mShort()} ${c.seconds}${sShort()}`;
}

function tickCountdowns(): void {
  const tour = featuredTournament();
  const fc = document.querySelector('#fcCountdown');
  if (fc && tour) fc.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <span class="cd-val">${fmt(tour.endsAt)}</span>`;
  document.querySelectorAll<HTMLElement>('.tc-count, .dc-count').forEach((el) => {
    const end = Number(el.dataset.ends);
    el.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <strong>${fmt(end)}</strong>`;
  });
}

// --- Render all + language --------------------------------------------------
function renderAll(): void {
  renderPromo();
  renderMyStats();
  renderFeatured();
  renderStats();
  renderTournaments();
  renderGames();
  renderDraws();
  renderWinners();
  renderBrain();
  applyTranslations();
  const search = document.querySelector<HTMLInputElement>('#gameSearch');
  if (search) search.placeholder = t('hub.searchGames');
  tickCountdowns();
  void refreshFeatured(); // swap in real scores once they load
  void renderDashboard();
}

// Load authoritative tournament config + the player's entries (online), then
// re-render so cards reflect real state. No-ops to local data offline.
async function refreshData(): Promise<void> {
  await Promise.all([loadTournaments(), loadMyEntries()]);
  renderFeatured();
  renderTournaments();
  void renderDashboard();
}

function syncLangButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('.set-lang-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === lang());
  });
}
function pick(l: Lang): void { setLang(l); syncLangButtons(); renderAll(); }

// --- Settings dropdown (gear menu) -----------------------------------------
// Houses the language switch (so it's reachable on mobile where the top nav is
// hidden), a sound toggle, terms/FAQ, and account actions — telefun-style.
function mountSettings(): void {
  const btn = document.querySelector<HTMLButtonElement>('#settingsBtn');
  if (!btn) return;
  const menu = document.createElement('div');
  menu.className = 'settings-menu';
  menu.hidden = true;
  document.body.appendChild(menu);

  const close = (): void => { menu.hidden = true; };
  const position = (): void => {
    const r = btn.getBoundingClientRect();
    menu.style.top = `${r.bottom + 8}px`;
    menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  };

  async function build(): Promise<void> {
    const user = await currentUser();
    menu.innerHTML = `
      <div class="sm-row sm-static">
        <span class="sm-label">${t('set.language')}</span>
        <span class="sm-langbtns">
          <button class="set-lang-btn" data-lang="en">EN</button>
          <button class="set-lang-btn" data-lang="am">አማ</button>
        </span>
      </div>
      <button class="sm-row" id="smSound"><span class="sm-label">${t('set.sound')}</span><span class="sm-toggle${sfx.muted ? '' : ' on'}"></span></button>
      <button class="sm-row" id="smTest"><span class="sm-label">🧪 ${t('set.testMode')}</span><span class="sm-toggle${isTestMode() ? ' on' : ''}"></span></button>
      <a class="sm-row" href="#" id="smTerms"><span class="sm-label">${t('set.terms')}</span><span class="sm-chev">›</span></a>
      <a class="sm-row" href="#" id="smFaq"><span class="sm-label">${t('set.faq')}</span><span class="sm-chev">›</span></a>
      <button class="sm-row" id="smUnsub"><span class="sm-label">${t('set.unsub')}</span></button>
      ${user ? `<button class="sm-row danger" id="smLogout"><span class="sm-label">${t('set.logout')}</span></button>` : ''}`;
    syncLangButtons();
    menu.querySelectorAll<HTMLButtonElement>('.set-lang-btn').forEach((b) =>
      b.addEventListener('click', () => { pick(b.dataset.lang as Lang); void build(); }));
    menu.querySelector('#smSound')!.addEventListener('click', () => { sfx.toggleMute(); void build(); });
    menu.querySelector('#smTest')!.addEventListener('click', () => {
      const on = !isTestMode();
      setTestMode(on);
      // Enabling test mode tops up the local play currencies so the gold/points
      // flows (spins, draws) are exercisable too — chance wins and free entry
      // are handled live by GameHost reading isTestMode().
      if (on) { earn('points', 100_000); earn('gold', 1_000); }
      void build();
      renderAll();
    });
    menu.querySelector('#smTerms')!.addEventListener('click', (e) => e.preventDefault());
    menu.querySelector('#smFaq')!.addEventListener('click', (e) => e.preventDefault());
    menu.querySelector('#smUnsub')!.addEventListener('click', close);
    menu.querySelector('#smLogout')?.addEventListener('click', async () => { await signOut(); close(); });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) { void build().then(() => { position(); menu.hidden = false; }); }
    else close();
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target as Node)) close(); });
  window.addEventListener('resize', () => { if (!menu.hidden) position(); });
}

// Nav active-state on scroll (top nav + mobile bottom nav).
const sections = ['statsStrip', 'games', 'tournaments', 'draws', 'winners', 'dashboard', 'brain'];
function syncNavActive(): void {
  let current = sections[0];
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 120) current = id;
  }
  document.querySelectorAll<HTMLElement>('.nav-link, .bn-item').forEach((a) => {
    const href = a.getAttribute('href');
    if (href) a.classList.toggle('active', href === `#${current}`);
  });
}
window.addEventListener('scroll', syncNavActive, { passive: true });

// Browse controls (segmented filter + search) and the bottom-nav account tab.
function setupBrowse(): void {
  const search = document.querySelector<HTMLInputElement>('#gameSearch');
  if (search) {
    search.placeholder = t('hub.searchGames');
    search.addEventListener('input', () => { gameQuery = search.value; renderGames(); });
  }
  document.querySelectorAll<HTMLButtonElement>('#gameSeg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      gameFilter = (b.dataset.filter as typeof gameFilter) ?? 'all';
      document.querySelectorAll('#gameSeg .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderGames();
    });
  });
  document.querySelector('#bnAccount')?.addEventListener('click', () => void openAccount());
}

// One-time economy reset — wipe stale cached balances so everyone starts fresh.
if (localStorage.getItem('innoarcade.reset.v3') !== '1') {
  ['innoarcade.points.v1', 'innoarcade.gold.v1', 'innoarcade.wallet.balance.v1',
   'innoarcade.wallet.ledger.v1', 'innoarcade.draw.tickets.v1'].forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('innoarcade.reset.v3', '1');
}

document.documentElement.lang = getLang();
syncLangButtons();
injectDashboardStyles();
renderAll();
// Keep the top balances strip live as coins/points/gold change.
onWalletChange(renderMyStats);
onCurrencyChange(renderMyStats);
setupBrowse();
syncNavActive();
mountSettings();
mountSignIn();
void mountWallet();
void refreshData();
// Re-pull wallet/entries/standing when the player signs in or out.
onAuthChange(() => { void refreshData(); });
setInterval(tickCountdowns, 1000);
setInterval(advancePromo, 4500);
