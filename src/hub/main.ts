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
import { CATALOG, orderedCatalog, getGame, type GameMeta } from '../platform/catalog';
import {
  activeTournaments, featuredTournament, tournamentGame, leaderboard,
  playerStanding, countdown, loadTournaments, loadMyEntries,
  tournamentState, isPaid, isEntered, enterTournament, prizePool,
  InsufficientCoinsError, type Tournament,
} from '../platform/tournaments';
import { balanceSync, onWalletChange } from '../platform/wallet';
import { SignInRequiredError } from '../platform/payments';
import { activeDraws, myTickets, enterDraw, recentWinners, NotEnoughPointsError, type DrawPeriod, type Winner } from '../platform/draws';
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
  { en: 'Play Lucky games for instant rewards', am: 'ለፈጣን ሽልማት ዕድል ጨዋታዎችን ይጫወቱ', icon: '🍀', grad: ['#2fae5a', '#1f8f3f'] },
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

// --- Games library (flat, ordered) ------------------------------------------
// The category shown on a card = the first token of its genre ("Chance · …").
const category = (g: GameMeta): string => genre(g).split('·')[0].trim();

// Short "how to play" guide per game (EN/AM). Surfaced from an ℹ️ button on each
// card. Falls back to a generic line for any game without a bespoke entry.
const HOWTO: Record<string, { en: string; am: string }> = {
  'popblast': { en: 'Tap groups of 2+ matching gems to pop them. Bigger groups score more. Clear as many as you can before moves run out.', am: 'ተመሳሳይ ቀለም ያላቸውን 2+ ዕንቁዎች ነክተው ያፈንዱ። ትልቅ ቡድን ብዙ ነጥብ ይሰጣል።' },
  'luckyslot': { en: 'Tap Spin and line up matching symbols across the reels to win. Each spin uses your entry; matches pay out points.', am: 'ስፒን ይንኩ፤ ተመሳሳይ ምልክቶችን ሲያሰልፉ ያሸንፋሉ።' },
  'memory-match': { en: 'Flip two cards at a time to find matching pairs. Match every pair using as few moves as possible.', am: 'ሁለት ካርዶችን ገልብጠው ተመሳሳይ ጥንዶችን ያግኙ። ሁሉንም በትንሹ እንቅስቃሴ ያዛምዱ።' },
  'merge-2048': { en: 'Swipe to slide tiles; equal numbers merge and double. Keep merging to reach the 2048 tile.', am: 'ሰቆችን ያንሸራትቱ፤ እኩል ቁጥሮች ሲገናኙ ይዋሃዳሉ። 2048 ለመድረስ ይቀጥሉ።' },
  'spin-wheel': { en: 'Tap to spin the wheel. Where it stops decides your reward — land on a winning wedge to score.', am: 'መንኮራኩሩን ለማሽከርከር ይንኩ። የሚያርፍበት ቦታ ሽልማትዎን ይወስናል።' },
  'ethiopian-quiz': { en: 'Answer 5 multiple-choice questions about Ethiopia. Pick the correct option; 3+ correct wins points.', am: 'ስለ ኢትዮጵያ 5 ጥያቄዎችን ይመልሱ። ትክክለኛውን ይምረጡ፤ 3+ ሲያገኙ ነጥብ ያሸንፋሉ።' },
  'dice-roll': { en: 'Tap Roll. Matching dice (doubles) win and award points. Roll again to push your score.', am: 'ጥሉ ይንኩ። ተመሳሳይ ዳይስ (ድርብ) ሲመጣ ያሸንፋሉ።' },
  'lucky-box': { en: 'Pick a box to reveal what’s inside. Some boxes hold prizes — choose well to win points.', am: 'ሳጥን ይምረጡ፤ ውስጡን ይክፈቱ። አንዳንዶቹ ሽልማት አላቸው።' },
  'temple-dash': { en: 'Run, jump and slide to dodge obstacles. Survive as long as you can for a high score.', am: 'እንቅፋቶችን ለማምለጥ ይሩጡ፣ ይዝለሉ። በተቻለ መጠን ይኑሩ።' },
  'sudoku': { en: 'Fill the grid so every row, column and box has 1–9 with no repeats.', am: 'እያንዳንዱ ረድፍ፣ አምድ እና ሳጥን 1–9 እንዲይዝ ሰንጠረዡን ይሙሉ።' },
  'crash-game': { en: 'Cash out before the rocket crashes. The longer you wait the bigger the multiplier — but don’t be greedy.', am: 'ሮኬቱ ከመውደቁ በፊት ያውጡ። በቆዩ ቁጥር ብዜቱ ይጨምራል።' },
  'spell': { en: 'Spell the word from the clue letter by letter.', am: 'ከፍንጭ ቃሉን ፊደል በፊደል ይጻፉ።' },
  'vocab': { en: 'Choose the correct meaning of the given word.', am: 'የተሰጠውን ቃል ትክክለኛ ትርጉም ይምረጡ።' },
  'rhyme': { en: 'Pick the word that rhymes with the prompt.', am: 'ከተሰጠው ጋር የሚገጥመውን ቃል ይምረጡ።' },
  'target24': { en: 'Combine the numbers with + − × ÷ to make exactly 24.', am: 'ቁጥሮቹን በ+ − × ÷ አጣምረው 24 ያድርጉ።' },
  'crosssum': { en: 'Fill cells so each row and column adds to its target sum.', am: 'እያንዳንዱ ረድፍና አምድ ወደ ዒላማው እንዲደምር ይሙሉ።' },
  'logic': { en: 'Use the clues to deduce the correct grid arrangement.', am: 'ፍንጮችን ተጠቅመው ትክክለኛውን ድልድል ያውጡ።' },
  'sequence': { en: 'Work out the pattern and pick the next item in the sequence.', am: 'ቅጥውን አውቀው ቀጣዩን ይምረጡ።' },
};
const howToText = (g: GameMeta): { en: string; am: string } =>
  HOWTO[g.id] ?? { en: `Tap Play to start ${g.nameEn}. Score as high as you can!`, am: `${g.nameAm}ን ለመጀመር ይጫወቱ።` };
function howTo(g: GameMeta): string { const h = howToText(g); return lang() === 'am' ? h.am : h.en; }

function gameCard(g: GameMeta): string {
  const modeTag = g.mode === 'tournament'
    ? `<span class="gc-tag tournament">🏆 ${t('hub.tournament')}</span>`
    : `<span class="gc-tag free">${t('arc.free')}</span>`;
  return `
    <a class="game-card" href="${g.route}">
      <div class="gc-thumb">
        <span class="gc-glyph">${g.icon}</span>
        ${modeTag}
        <button class="gc-info" data-howto="${g.id}" aria-label="${t('hub.howToPlay')}">ℹ️</button>
      </div>
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p class="gc-cat">${escapeHtml(category(g))}</p>
        <span class="gc-play">▶ ${t('hub.play')}</span>
      </div>
    </a>`;
}

// "How to play" modal, opened by the ℹ️ button on a card. The button lives inside
// the card's <a>, so we stop the click from navigating.
function openHowTo(g: GameMeta): void {
  document.querySelector('.howto-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'howto-modal';
  m.innerHTML = `<div class="howto-scrim"></div>
    <div class="howto-card">
      <div class="howto-head"><span class="howto-icon">${g.icon}</span><h3>${escapeHtml(name(g))}</h3></div>
      <p class="howto-sub">${t('hub.howToPlay')}</p>
      <p class="howto-body">${escapeHtml(howTo(g))}</p>
      <a class="btn primary howto-play" href="${g.route}">▶ ${t('hub.play')}</a>
      <button class="btn ghost howto-close">${t('hub.cancel')}</button>
    </div>`;
  document.body.appendChild(m);
  const close = (): void => m.remove();
  m.querySelector('.howto-scrim')!.addEventListener('click', close);
  m.querySelector('.howto-close')!.addEventListener('click', close);
}

// Browse state: the top segmented menu filters by tag (all / tournament / free).
let gameFilter: 'all' | 'tournament' | 'free' = 'all';
let gameQuery = '';

// A single flat library (no category sections), ordered by the catalog's
// preferred order, filtered by the tag menu + search.
function renderGames(): void {
  const host = $('#gameGrid');
  const q = gameQuery.trim().toLowerCase();
  const pool = orderedCatalog().filter((g) => {
    if (gameFilter !== 'all' && g.mode !== gameFilter) return false;
    if (q && !`${g.nameEn} ${g.nameAm} ${g.genreEn}`.toLowerCase().includes(q)) return false;
    return true;
  });
  host.innerHTML = pool.length
    ? `<div class="cat-shelf">${pool.map(gameCard).join('')}</div>`
    : `<p class="cat-empty">${t('hub.noResults')}</p>`;
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

const PERIOD_LABEL: Record<DrawPeriod, { en: string; am: string }> = {
  daily: { en: 'Daily', am: 'ዕለታዊ' },
  weekly: { en: 'Weekly', am: 'ሳምንታዊ' },
  monthly: { en: 'Monthly', am: 'ወርሃዊ' },
};
const periodLabel = (p: DrawPeriod): string => (lang() === 'am' ? PERIOD_LABEL[p].am : PERIOD_LABEL[p].en);

function renderWinners(): void {
  const host = document.querySelector('#winnerList');
  if (!host) return;
  const all = recentWinners(Date.now(), 12);
  const row = (w: Winner): string => `
    <div class="winner-row">
      <span class="wr-ico">🎉</span>
      <span class="wr-phone">${escapeHtml(w.phone)}</span>
      <span class="wr-prize">${w.prizeEtb.toLocaleString()} ETB</span>
    </div>`;
  host.innerHTML = (['daily', 'weekly', 'monthly'] as DrawPeriod[]).map((p) => {
    const rows = all.filter((w) => w.period === p);
    if (!rows.length) return '';
    return `<div class="winner-group">
      <h4 class="wg-head"><span class="wg-badge wg-${p}">${periodLabel(p)}</span></h4>
      ${rows.map(row).join('')}
    </div>`;
  }).join('');
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
    // Right-align the menu under the gear, but clamp so it never spills off the
    // (narrow, mobile) viewport — the old right-only positioning pushed it
    // off-screen when the gear sat near the edge.
    const w = menu.offsetWidth || 232;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.right = 'auto';
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
const sections = ['statsStrip', 'games', 'tournaments', 'draws', 'winners', 'dashboard'];
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
  // Delegated ℹ️ "how to play" — intercept before the card link navigates.
  document.querySelector('#gameGrid')?.addEventListener('click', (e) => {
    const info = (e.target as HTMLElement).closest<HTMLElement>('.gc-info');
    if (!info) return;
    e.preventDefault();
    e.stopPropagation();
    const g = getGame(info.dataset.howto!);
    if (g) openHowTo(g);
  });
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
