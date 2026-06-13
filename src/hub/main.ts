import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../i18n';
import { mountSignIn, openSignIn } from './signin';
import { mountWallet, openStore, needsSignInToBuy } from './wallet';
import { onAuthChange } from '../platform/auth';
import { renderDashboard, injectDashboardStyles } from './dashboard';
import { mergedLeaderboard } from '../platform/backend';
import { CATALOG, type GameMeta } from '../platform/catalog';
import {
  activeTournaments, featuredTournament, tournamentGame, leaderboard,
  playerStanding, countdown, loadTournaments, loadMyEntries,
  tournamentState, isPaid, isEntered, enterTournament, prizePool,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { balanceSync } from '../platform/wallet';

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
        if (e instanceof InsufficientCoinsError) { renderEntryActions(m, tour, game); return; }
        m.querySelector('#err')!.textContent = t('hub.needCoins');
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
const AM_CAT: Record<string, string> = {
  Arcade: 'አርኬድ', Puzzle: 'እንቆቅልሽ', Runner: 'ሩጫ', Skill: 'ክህሎት', Casual: 'ቀላል',
};
function catKey(g: GameMeta): string { return g.genreEn.split('·')[0].trim(); }
function catLabel(key: string): string { return lang() === 'am' ? (AM_CAT[key] ?? key) : key; }

function gameCard(g: GameMeta): string {
  return `
    <a class="game-card" href="${g.route}">
      <div class="gc-thumb" style="${thumbStyle(g)}">
        <span class="gc-glyph">${g.icon}</span>
        ${g.mode === 'tournament' ? `<span class="gc-tag">🏆 ${t('hub.tournament')}</span>` : ''}
      </div>
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p>${escapeHtml(genre(g))}</p>
      </div>
    </a>`;
}

function renderGames(): void {
  const host = $('#gameGrid');
  const cats = new Map<string, GameMeta[]>();
  for (const g of CATALOG) {
    const k = catKey(g);
    if (!cats.has(k)) cats.set(k, []);
    cats.get(k)!.push(g);
  }
  host.innerHTML = [...cats.entries()].map(([key, list]) => `
    <div class="cat-block">
      <div class="cat-head"><h3>${escapeHtml(catLabel(key))}</h3></div>
      <div class="cat-grid">${list.map(gameCard).join('')}</div>
    </div>`).join('');
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
      <div class="gc-thumb" style="background:linear-gradient(145deg, ${g.thumb[0]}, ${g.thumb[1]});">
        <span class="gc-glyph">${g.icon}</span>
      </div>
      <div class="gc-body"><h4>${escapeHtml(lang() === 'am' ? g.nameAm : g.nameEn)}</h4></div>
    </a>`).join('');
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
  document.querySelectorAll<HTMLElement>('.tc-count').forEach((el) => {
    const end = Number(el.dataset.ends);
    el.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <strong>${fmt(end)}</strong>`;
  });
}

// --- Render all + language --------------------------------------------------
function renderAll(): void {
  renderFeatured();
  renderTournaments();
  renderGames();
  renderBrain();
  applyTranslations();
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

const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  langEn.classList.toggle('active', lang() === 'en');
  langAm.classList.toggle('active', lang() === 'am');
}
function pick(l: Lang): void { setLang(l); syncLangButtons(); renderAll(); }
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

// Nav active-state on scroll.
const sections = ['dashboard', 'tournaments', 'games', 'brain'];
window.addEventListener('scroll', () => {
  let current = sections[0];
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 120) current = id;
  }
  document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
  });
}, { passive: true });

document.documentElement.lang = getLang();
syncLangButtons();
injectDashboardStyles();
renderAll();
mountSignIn();
void mountWallet();
void refreshData();
// Re-pull wallet/entries/standing when the player signs in or out.
onAuthChange(() => { void refreshData(); });
setInterval(tickCountdowns, 1000);
