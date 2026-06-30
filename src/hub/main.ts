import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../i18n';
import { openSignIn } from './signin';
import { openAccount } from './account';
import { mountWallet, openStore } from './wallet';
import { onAuthChange, currentUser, signOut, authAvailable } from '../platform/auth';
import { sfx } from '../engine/audio';
import { leaderboardRemote, fetchWallets, fetchUnlocks, unlockGameRemote, fetchTournamentPeriodWinners, claimDailyLogin, mergedLeaderboard } from '../platform/backend';
import { orderedCatalog, getGame, type GameMeta, type TournamentCadence } from '../platform/catalog';
import {
  activeTournaments, tournamentGame, getTournamentForGame, getLiveTournamentByCadence,
  countdown, loadTournaments, loadMyEntries,
  tournamentState, enterTournament,
  type Tournament, type LeaderEntry,
} from '../platform/tournaments';
import { balanceSync, balance, onWalletChange } from '../platform/wallet';
import { openTournamentEntry } from './tournamentEntry';
import { activeDraws, myTickets, enterDraw, NotEnoughPointsError, hydrateTickets, loadDraws, myOdds } from '../platform/draws';
import { xp as xpBal, onCurrencyChange, setBalance, setLifetime, xpLifetime } from '../platform/currency';
import { levelFor, economyNeedsAuth, WINNER_ETB_PRIZES, type WinnerCadence } from '../platform/config';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const lang = (): Lang => getLang();
const name = (g: GameMeta): string => (lang() === 'am' ? g.nameAm : g.nameEn);
const genre = (g: GameMeta): string => (lang() === 'am' ? g.genreAm : g.genreEn);
const tTitle = (x: Tournament): string => (lang() === 'am' ? x.titleAm : x.titleEn);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
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

// Auto-advance timer the player can interrupt by swiping/tapping a dot.
let promoTimer: ReturnType<typeof setInterval> | undefined;
function restartPromoTimer(): void {
  if (promoTimer) clearInterval(promoTimer);
  promoTimer = setInterval(advancePromo, 4500);
}
function goToPromo(i: number): void {
  promoIdx = (i + PROMOS.length) % PROMOS.length;
  renderPromo();
  restartPromoTimer(); // a manual move resets the auto cadence
}

// Manual control: swipe left/right on the banner, or tap a dot.
function setupPromo(): void {
  const track = document.querySelector<HTMLElement>('#promoTrack');
  const dots = document.querySelector<HTMLElement>('#promoDots');
  dots?.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>('.promo-dot');
    if (!dot || !dot.parentElement) return;
    goToPromo([...dot.parentElement.children].indexOf(dot));
  });
  if (track) {
    let startX = 0, active = false;
    track.addEventListener('pointerdown', (e) => { active = true; startX = e.clientX; });
    track.addEventListener('pointerup', (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40) goToPromo(promoIdx + (dx < 0 ? 1 : -1));
    });
    track.addEventListener('pointercancel', () => { active = false; });
    track.style.touchAction = 'pan-y'; // allow vertical scroll, capture horizontal swipe
  }
}

// --- Live tournament leaderboards (daily / weekly / monthly) ----------------
let liveCadence: TournamentCadence = 'daily';

function tourLbRow(r: LeaderEntry): string {
  const medal = ['🥇', '🥈', '🥉'];
  const rp = r.rp ?? r.score;
  return `
    <div class="lb-row${r.rank <= 3 ? ' top' : ''}${r.isPlayer ? ' me' : ''}">
      <span class="lb-rank">${medal[r.rank - 1] ?? '#' + r.rank}</span>
      <span class="lb-name">${escapeHtml(r.isPlayer ? t('td.you') : r.name)}</span>
      <span class="lb-score">${rp} RP</span>
    </div>`;
}

function renderLiveBoard(): void {
  const host = document.querySelector('#globalBoard');
  const banner = document.querySelector('#liveBoardBanner');
  if (!host) return;
  const tour = getLiveTournamentByCadence(liveCadence);
  const game = tour ? getGame(tour.gameId) : undefined;
  if (!tour || !game) {
    host.innerHTML = `<p class="pd-empty">${t('hub.unranked')}</p>`;
    if (banner) banner.innerHTML = '';
    return;
  }
  if (banner) {
    banner.innerHTML = `
      <span class="sb-glow">${game.icon}</span>
      <div class="sb-body">
        <span class="sb-title">${escapeHtml(tTitle(tour))}</span>
        <span class="sb-sub">${escapeHtml(name(game))} · ${t('hub.endsIn')} <strong data-ends="${tour.endsAt}">${fmt(tour.endsAt)}</strong></span>
      </div>
      <span class="sb-meta">${t('hub.rankedByRp')}</span>`;
  }
  void leaderboardRemote(tour.id, 10).then((rows) => {
    host.innerHTML = rows.length
      ? rows.map(tourLbRow).join('')
      : `<p class="pd-empty">${t('hub.noBoardYet')}</p>`;
  });
}

function setupLiveBoardTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('#liveBoardSeg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      liveCadence = (b.dataset.cadence as TournamentCadence) ?? 'daily';
      document.querySelectorAll('#liveBoardSeg .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderLiveBoard();
    });
  });
}

// --- Player balance bar -----------------------------------------------------
// The Level / XP / Coins chips render in their own bar right under the promo
// banner (where the KPI strip used to be). The Buy Coin button stays in the topbar.
function renderMyStats(): void {
  function chip(icon: string, label: string, val: string, cls: string): string {
    return `<span class="bal-chip ${cls}">${icon} <span class="bal-lbl">${label}:</span> <strong>${val}</strong></span>`;
  }
  const bar = document.querySelector('#playerBar');
  if (bar) {
    bar.innerHTML =
      chip('🎖️', t('hub.statLevel'), String(levelFor(xpLifetime())), 'bal-level') +
      chip('⭐', t('hub.progress'), xpLifetime().toLocaleString(), 'bal-points') +
      chip('🪙', t('hub.coinsLabel'), balanceSync().toLocaleString(), 'bal-coins');
  }
  const host = document.querySelector('#topBalances');
  if (host) {
    host.innerHTML = `<button class="bal-buy" id="buyCoinsBtn">${t('hub.buyCoins')}</button>`;
    host.querySelector('#buyCoinsBtn')?.addEventListener('click', () => openStore());
  }
}

// --- Tournament entry economy (confirm flow) --------------------------------

// Attach handlers to register buttons / play links inside a freshly-rendered root.
function wireEntryCtas(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) => {
    b.addEventListener('click', () => {
      const tour = activeTournaments().find((x) => x.id === b.dataset.enter);
      const game = tour ? tournamentGame(tour) : undefined;
      if (tour && game) openTournamentEntry({ tour, game, onEntered: () => renderAll(), playHref: game.route });
    });
  });
  // Free / already-entered play links also record an entry so they show on the
  // dashboard (idempotent; navigation proceeds normally).
  document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => {
    a.addEventListener('click', () => { void enterTournament(a.dataset.play!).catch(() => {}); });
  });
}

// --- Games library (flat, ordered) ------------------------------------------
// The category shown on a card = the first token of its genre ("Chance · …").
const category = (g: GameMeta): string => genre(g).split('·')[0].trim();

// Short "how to play" guide per game (EN/AM). Surfaced from an ℹ️ button on each
// card. Falls back to a generic line for any game without a bespoke entry.
const HOWTO: Record<string, { en: string; am: string }> = {
  'popblast': { en: 'Swap two neighbouring candies to line up 3+ of the same colour. Each match clears them and scores. Match as many as you can before moves run out.', am: 'ተመሳሳይ ቀለም ያላቸውን 3+ ለማሰለፍ ሁለት ጎረቤት ከረሜላዎችን ይቀያይሩ። እያንዳንዱ ግጥሚያ ነጥብ ይሰጣል።' },
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
  'orbit-blast': { en: 'Tap to fire at the orbiting targets. Time your shots to clear waves and rack up a high score.', am: 'በምህዋር ያሉ ኢላማዎችን ለመምታት ይንኩ። ሞገዶችን አጽድተው ከፍተኛ ነጥብ ያስመዝግቡ።' },
  'metro-rush': { en: 'Swipe to switch lanes, jump and slide past trains. Run as far as you can without crashing.', am: 'መንገድ ለመቀየር ያንሸራትቱ፣ ይዝለሉ። ሳይጋጩ በተቻለ መጠን ይሩጡ።' },
  'candy-crunch': { en: 'Swap adjacent candies to line up 3+ of a colour. Clear the board’s goals before moves run out.', am: 'ተጎራባች ከረሜላዎችን ቀይረው 3+ ተመሳሳይ ቀለም ያሰልፉ።' },
  'dot-link': { en: 'Drag to connect dots of the same colour without crossing lines. Fill the board to clear it.', am: 'ተመሳሳይ ቀለም ያላቸውን ነጥቦች ሳያቋርጡ ያገናኙ።' },
  'brick-blitz': { en: 'Move the paddle to bounce the ball and break every brick. Don’t let the ball fall.', am: 'ኳሷን ለመመለስና ሁሉንም ጡቦች ለመስበር ፓዱን ያንቀሳቅሱ።' },
  'fruit-slice': { en: 'Swipe across flying fruit to slice it. Avoid the bombs and keep your combo going.', am: 'የሚበሩ ፍራፍሬዎችን ለመቁረጥ ያንሸራትቱ። ቦምቦችን ያስወግዱ።' },
  'sky-hopper': { en: 'Tap to hop upward from platform to platform. Climb as high as you can without falling.', am: 'ከመድረክ ወደ መድረክ ለመዝለል ይንኩ። ሳይወድቁ ከፍ ብለው ይውጡ።' },
  'bubble-pop': { en: 'Aim and shoot bubbles to group 3+ of a colour and pop them. Clear the board to win.', am: '3+ ተመሳሳይ ቀለም ለማሰባሰብ አረፋዎችን ይተኩሱ።' },
  'tap-game': { en: 'Tap as fast and accurately as you can before the timer runs out. Higher taps, higher score.', am: 'ሰዓቱ ከማለቁ በፊት በፍጥነትና በትክክል ይንኩ።' },
  'scratch-card': { en: 'Scratch the card to reveal symbols. Match the winning symbols to score a prize.', am: 'ምልክቶችን ለማሳየት ካርዱን ይፋቁ። አሸናፊ ምልክቶችን ሲያዛምዱ ይሸልማሉ።' },
};
const howToText = (g: GameMeta): { en: string; am: string } =>
  HOWTO[g.id] ?? { en: `Tap Play to start ${g.nameEn}. Score as high as you can!`, am: `${g.nameAm}ን ለመጀመር ይጫወቱ።` };
function howTo(g: GameMeta): string { const h = howToText(g); return lang() === 'am' ? h.am : h.en; }

// In-memory set of games the player has bought early (server is the authority).
// Hydrated on load + on auth change; drives locked-card rendering synchronously.
const unlockedSet = new Set<string>();

// A game is locked when it's gated above the player's level and not yet unlocked.
function isLocked(g: GameMeta): boolean {
  return !!g.minLevel && levelFor(xpLifetime()) < g.minLevel && !unlockedSet.has(g.id);
}

function gameCard(g: GameMeta): string {
  const modeTag = g.mode === 'tournament'
    ? `<span class="gc-tag tournament">🏆 ${t('hub.tournament')}</span>`
    : `<span class="gc-tag free">${t('arc.free')}</span>`;
  // A tournament game with a live window gets the pulsing "Live" badge on its art.
  const tour = g.mode === 'tournament' ? getTournamentForGame(g.id) : undefined;
  const liveBadge = tour && tournamentState(tour) === 'live'
    ? `<span class="gc-live live-dot">● ${t('hub.live')}</span>` : '';
  const thumb = `
      <div class="gc-thumb${g.cover ? ' gc-thumb-cover' : ''}">
        ${g.cover
          ? `<img class="gc-cover" src="${g.cover}" alt="" loading="lazy" />`
          : `<span class="gc-glyph">${g.icon}</span>`}
        ${modeTag}
        ${liveBadge}
        <button class="gc-info" data-howto="${g.id}" aria-label="${t('hub.howToPlay')}">?</button>
        ${isLocked(g) ? `<span class="gc-lock">🔒 ${t('hub.lockLevel')} ${g.minLevel}</span>` : ''}
      </div>`;
  // Locked games are a non-navigating tile that opens the unlock dialog.
  if (isLocked(g)) {
    return `
    <div class="game-card locked" data-unlock="${g.id}">
      ${thumb}
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p class="gc-cat">${escapeHtml(category(g))}</p>
        <span class="gc-play gc-unlock">🔓 ${t('hub.unlock')} · ${g.unlockCost} 🪙</span>
      </div>
    </div>`;
  }
  return `
    <a class="game-card" href="${g.route}">
      ${thumb}
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p class="gc-cat">${escapeHtml(category(g))}</p>
        <span class="gc-play">▶ ${t('hub.play')}</span>
      </div>
    </a>`;
}

// "How to play" modal, opened by the ℹ️ button on a card. The button lives inside
// the card's <a>, so we stop the click from navigating.
// The live tournament whose game is `g`, if any (reverse of tournamentGame).
function tournamentForGame(g: GameMeta): ReturnType<typeof activeTournaments>[number] | undefined {
  return activeTournaments().find((tr) => tournamentGame(tr)?.id === g.id);
}

// Game/tournament intro: cover, description, rules, entry cost + reward, and —
// for tournament games — the live top score and the player's best, before they
// play. The Play button carries the entry economy through the game host as usual.
function openHowTo(g: GameMeta): void {
  document.querySelector('.howto-modal')?.remove();
  const tour = tournamentForGame(g);
  const fee = tour ? tour.entryFeeCoins : 0;
  const m = document.createElement('div');
  m.className = 'howto-modal';
  m.innerHTML = `<div class="howto-scrim"></div>
    <div class="howto-card">
      <div class="howto-cover">${g.cover ? `<img src="${g.cover}" alt="" />` : `<span class="howto-icon">${g.icon}</span>`}
        <span class="howto-mode ${g.mode}">${g.mode === 'tournament' ? `🏆 ${t('hub.tournament')}` : t('arc.free')}</span></div>
      <h3 class="howto-name">${escapeHtml(name(g))}</h3>
      <p class="howto-cat">${escapeHtml(category(g))}</p>
      <div class="howto-econ">
        <span class="howto-chip">${fee > 0 ? `${t('hub.entry')}: ${fee} 🪙` : '🆓'}</span>
        <span class="howto-chip reward">${t('hub.reward')}: ⭐</span>
      </div>
      ${tour ? `<div class="howto-scores" id="howtoScores"><span class="hs-load">…</span></div>` : ''}
      <p class="howto-sub">📖 ${t('hub.rules')}</p>
      <p class="howto-body">${escapeHtml(howTo(g))}</p>
      <a class="btn primary howto-play" href="${g.route}">▶ ${tour ? t('hub.register') + (fee > 0 ? ` · ${fee} 🪙` : '') : t('hub.play')}</a>
      <button class="btn ghost howto-close">${t('hub.cancel')}</button>
    </div>`;
  document.body.appendChild(m);
  const close = (): void => m.remove();
  m.querySelector('.howto-scrim')!.addEventListener('click', close);
  m.querySelector('.howto-close')!.addEventListener('click', close);
  // Fill the your-best-vs-top row from the authoritative server leaderboard.
  if (tour) {
    void mergedLeaderboard(tour.id).then((board) => {
      const el = m.querySelector('#howtoScores');
      if (!el) return;
      const top = board[0];
      const mine = board.find((r) => r.isPlayer);
      el.innerHTML = `
        <div class="hs-cell"><span class="hs-lbl">🏆 ${t('hub.topScore')}</span><strong>${top ? top.score.toLocaleString() : '—'}</strong></div>
        <div class="hs-cell"><span class="hs-lbl">👤 ${t('hub.yourBest')}</span><strong>${mine ? mine.score.toLocaleString() : '—'}</strong></div>`;
    });
  }
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
    const afford = xpBal() >= d.ticketCostPoints;
    const atCap = tickets >= d.maxTicketsPerUser;
    const odds = myOdds(d.id);
    const oddsPct = odds > 0 ? (odds * 100).toFixed(odds < 0.01 ? 2 : 1) : null;
    const canEnter = afford && !atCap;
    const label = atCap ? t('hub.ticketCap') : `${t('hub.enterDraw')} · ${d.ticketCostPoints} ⭐`;
    return `
      <article class="draw-card draw-${d.period}">
        <div class="dc-top">
          <span class="dc-period">${escapeHtml(lang() === 'am' ? d.titleAm : d.titleEn)}</span>
          <span class="dc-prize">${d.prizeEtb.toLocaleString()} ETB</span>
        </div>
        <div class="dc-count" data-ends="${d.endsAt}"></div>
        <div class="dc-foot">
          <span class="dc-tickets">🎟️ ${t('hub.yourTickets')}: <strong>${tickets}</strong>${oddsPct ? ` · ${t('hub.yourOdds')}: <strong>${oddsPct}%</strong>` : ''}</span>
          <button class="btn primary dc-enter${canEnter ? '' : ' disabled'}"${canEnter ? '' : ' disabled'} data-draw="${d.id}">${label}</button>
        </div>
      </article>`;
  }).join('');
  host.querySelectorAll<HTMLButtonElement>('.dc-enter').forEach((b) => {
    b.addEventListener('click', () => {
      const d = draws.find((x) => x.id === b.dataset.draw);
      if (!d) return;
      b.disabled = true;
      void enterDraw(d).then(() => { renderMyStats(); renderDraws(); })
        .catch((e) => {
          if (e instanceof NotEnoughPointsError) { b.textContent = t('hub.needPoints'); b.classList.add('disabled'); }
          else b.disabled = false;
        });
    });
  });
}

// Winners tab: Daily / Weekly / Monthly ETB prizes for the latest tournament window.
let winnerCadence: WinnerCadence = 'daily';

function formatEtbPrize(amount: number): string {
  if (lang() === 'am' && amount >= 1000) {
    const k = amount / 1000;
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `${label}ሺ ብር/ETB`;
  }
  return `${amount.toLocaleString()} ETB`;
}

function winnerPrizeForRank(cadence: WinnerCadence, rank: number): string {
  const prizes = WINNER_ETB_PRIZES[cadence];
  const etb = rank >= 1 && rank <= 3 ? prizes[rank - 1] : 0;
  return etb > 0 ? formatEtbPrize(etb) : '—';
}

function renderWinners(): void {
  const tbody = document.querySelector('#winnerList');
  if (!tbody) return;

  void fetchTournamentPeriodWinners(winnerCadence, 10).then((rows) => {
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="winners-empty">${t('hub.noWinnersYet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr class="winners-row${r.rank <= 3 ? ' top' : ''}${r.isPlayer ? ' me' : ''}">
        <td class="w-no">${r.rank}</td>
        <td class="w-phone">
          <span class="w-avatar" aria-hidden="true">👤</span>
          ${escapeHtml(r.phone)}
        </td>
        <td class="w-reward">${winnerPrizeForRank(winnerCadence, r.rank)}</td>
      </tr>`).join('');
  });
}

function setupWinnersTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('#winnersSeg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      winnerCadence = (b.dataset.cadence as WinnerCadence) ?? 'daily';
      document.querySelectorAll('#winnersSeg .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderWinners();
    });
  });
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
  document.querySelectorAll<HTMLElement>('.tc-count, .dc-count').forEach((el) => {
    const end = Number(el.dataset.ends);
    el.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <strong>${fmt(end)}</strong>`;
  });
  // Value-only countdowns (live board banner + draw cards).
  document.querySelectorAll<HTMLElement>('strong[data-ends]').forEach((el) => {
    el.textContent = fmt(Number(el.dataset.ends));
  });
}

// --- Render all + language --------------------------------------------------
function renderAll(): void {
  renderPromo();
  renderMyStats();
  wireEntryCtas();
  renderGames();
  renderDraws();
  renderLiveBoard();
  renderWinners();
  applyTranslations();
  const search = document.querySelector<HTMLInputElement>('#gameSearch');
  if (search) search.placeholder = t('hub.searchGames');
  tickCountdowns();
}

// Load authoritative tournament config + the player's entries (online), then
// re-render so cards reflect real state. No-ops to local data offline.
async function refreshData(): Promise<void> {
  await Promise.all([loadTournaments(), loadMyEntries()]);
  wireEntryCtas();
  renderGames();
  renderLiveBoard();
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
      <a class="sm-row" href="#" id="smTerms"><span class="sm-label">${t('set.terms')}</span><span class="sm-chev">›</span></a>
      <a class="sm-row" href="#" id="smFaq"><span class="sm-label">${t('set.faq')}</span><span class="sm-chev">›</span></a>
      <button class="sm-row" id="smUnsub"><span class="sm-label">${t('set.unsub')}</span></button>
      ${user ? `<button class="sm-row danger" id="smLogout"><span class="sm-label">${t('set.logout')}</span></button>` : ''}`;
    syncLangButtons();
    menu.querySelectorAll<HTMLButtonElement>('.set-lang-btn').forEach((b) =>
      b.addEventListener('click', () => { pick(b.dataset.lang as Lang); void build(); }));
    menu.querySelector('#smSound')!.addEventListener('click', () => { sfx.toggleMute(); void build(); });
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

// Mandatory sign-in gate: the whole portal is subscription/OTP based, so an
// unauthenticated visitor sees a blocking sign-in surface and cannot reach the
// games until they sign in with a phone number + OTP. (Only enforced when an
// auth backend is configured; otherwise the local demo stays open.)
function mountSignInGate(): void {
  if (!authAvailable()) return;
  const show = (): void => {
    if (document.getElementById('signinGate')) return;
    const g = document.createElement('div');
    g.id = 'signinGate';
    g.className = 'signin-gate';
    g.innerHTML = `
      <div class="sg-card">
        <div class="sg-brand"><span class="sg-icon">🎮</span> GoPlay</div>
        <h2>${t('gate.title')}</h2>
        <p>${t('gate.sub')}</p>
        <button class="btn primary" id="sgBtn">📱 ${t('gate.cta')}</button>
      </div>`;
    document.body.appendChild(g);
    g.querySelector('#sgBtn')!.addEventListener('click', () => openSignIn());
  };
  const hide = (): void => document.getElementById('signinGate')?.remove();
  void currentUser().then((u) => (u ? hide() : show()));
  onAuthChange((u) => (u ? hide() : show()));
}

// Nav active-state on scroll (top nav + mobile bottom nav).
const sections = ['games', 'topPlayers', 'winners'];
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
    if (info) {
      e.preventDefault();
      e.stopPropagation();
      const g = getGame(info.dataset.howto!);
      if (g) openHowTo(g);
      return;
    }
    // A locked tile doesn't navigate — it opens the unlock dialog instead.
    const locked = (e.target as HTMLElement).closest<HTMLElement>('.game-card.locked');
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      const g = getGame(locked.dataset.unlock!);
      if (g) openUnlock(g);
    }
  });
}

// Unlock dialog for a level-gated game: reach the required level for free, or buy
// it now with coins (server-validated charge). On success, mark unlocked + rerender.
function openUnlock(g: GameMeta): void {
  if (economyNeedsAuth()) { openSignIn(); return; }
  const lvl = levelFor(xpLifetime());
  const coins = balanceSync();
  const cost = g.unlockCost ?? 0;
  const canPay = coins >= cost;
  const m = document.createElement('div');
  m.className = 'unlock-modal';
  m.innerHTML = `
    <div class="unlock-scrim"></div>
    <div class="unlock-box" role="dialog" aria-modal="true">
      <span class="unlock-glyph">${g.cover ? `<img src="${g.cover}" alt="" />` : g.icon}</span>
      <h3>${escapeHtml(name(g))}</h3>
      <p class="unlock-msg">${t('hub.unlockReach')} ${g.minLevel} ${t('hub.unlockOrBuy')}</p>
      <p class="unlock-sub">${t('hub.statLevel')} ${lvl} · ${coins.toLocaleString()} 🪙</p>
      <div class="unlock-actions">
        <button id="uCancel" class="btn ghost">${t('hub.cancel')}</button>
        <button id="uBuy" class="btn primary" ${canPay ? '' : 'disabled'}>🔓 ${cost} 🪙</button>
      </div>
      ${canPay ? '' : `<button id="uGet" class="unlock-getcoins">${t('hub.buyCoins')}</button>`}
    </div>`;
  document.body.appendChild(m);
  const close = (): void => m.remove();
  m.querySelector('.unlock-scrim')!.addEventListener('click', close);
  m.querySelector('#uCancel')!.addEventListener('click', close);
  m.querySelector('#uGet')?.addEventListener('click', () => { close(); openStore(); });
  m.querySelector('#uBuy')!.addEventListener('click', async () => {
    const btn = m.querySelector('#uBuy') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = '…';
    try {
      const res = await unlockGameRemote(g.id);
      unlockedSet.clear(); res.unlocks.forEach((id) => unlockedSet.add(id));
      void balance(); // re-hydrate coin chip from the authoritative new balance
      close();
      renderGames();
      renderMyStats();
    } catch {
      btn.disabled = false; btn.textContent = `🔓 ${cost} 🪙`;
      btn.classList.add('shake');
    }
  });
}

// One-time cleanup — the economy is now 100% server-sourced, so wipe every
// legacy localStorage key the old local/offline economy used to write.
if (localStorage.getItem('innoarcade.reset.v4') !== '1') {
  [
    'innoarcade.points.v1', 'innoarcade.gold.v1', 'innoarcade.wallet.balance.v1',
    'innoarcade.wallet.ledger.v1', 'innoarcade.draw.tickets.v1', 'innoarcade.orders.v1',
    'innoarcade.config.v1', 'innoarcade.subscription.v1', 'innoarcade.trial.used.v1',
    'innoarcade.tournament.scores.v1', 'innoarcade.tournament.entries.v1',
    'innoarcade.tournaments.overrides.v1', 'innoarcade.tournaments.custom.v1',
    'innoarcade.tournaments.settled.v1', 'innoarcade.player.name', 'innoarcade.demo.role',
  ].forEach((k) => localStorage.removeItem(k));
  // Per-game local high scores (innoarcade.<game>.best) — scoring is server-only now.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith('innoarcade.') && k.endsWith('.best')) localStorage.removeItem(k);
  }
  localStorage.setItem('innoarcade.reset.v4', '1');
}

document.documentElement.lang = getLang();
syncLangButtons();
renderAll();
// Keep the top balances strip live as coins/points/gold change.
onWalletChange(renderMyStats);
onCurrencyChange(renderMyStats);
setupBrowse();
setupLiveBoardTabs();
setupWinnersTabs();
syncNavActive();
mountSettings();
mountSignInGate();
void mountWallet();
void refreshData();
// Hydrate the points balance from the server (the authority); refresh on load
// and whenever auth changes, then re-render the top balance strip.
let dailyClaimed = false; // once per page load (the server is idempotent per day)
function hydratePoints(): void {
  void fetchWallets().then((w) => {
    if (w) { setBalance('xp', w.xp); setLifetime(w.lifetime); renderMyStats(); }
    // Daily-login XP streak (doc §3.1) — claim once when signed in.
    if (w && !dailyClaimed) {
      dailyClaimed = true;
      void claimDailyLogin().then((d) => {
        if (d && d.award > 0) { setBalance('xp', d.xp); setLifetime(d.lifetime); renderMyStats(); }
      });
    }
  });
  void loadDraws().then(() => hydrateTickets()).then(() => renderDraws());
  renderWinners();
  void fetchUnlocks().then((ids) => {
    unlockedSet.clear(); ids.forEach((id) => unlockedSet.add(id)); renderGames();
  });
}
hydratePoints();
// Re-pull wallet/entries/standing when the player signs in or out.
onAuthChange(() => { void refreshData(); hydratePoints(); });
setInterval(tickCountdowns, 1000);
setupPromo();
restartPromoTimer();
