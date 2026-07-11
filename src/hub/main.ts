import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../i18n';
import { mountSignInGate } from '../platform/signInGate';
import { openAccount } from './account';
import { mountWallet } from './wallet';
import { onAuthChange, currentUser, signOut } from '../platform/auth';
import { sfx } from '../engine/audio';
import { levelFor, LEVEL_THRESHOLDS, etbPrizesForCadence, formatEtbPrize, TOURNAMENT_ETB_PRIZES, loadConfig, config, type WinnerCadence } from '../platform/config';
import { getRecentGames, getChallengeProgress, getGamesPlayedToday, setChallengeProgress, getActivityFeed, applyActivityRaw, getNotifications, setNotifications, unreadNotifCount, getWeeklyRank, setWeeklyRank, getOnlineCount, getAnalyticsTrendingIds, type ChallengeProgress } from '../platform/portalState';
import { leaderboardRemote, fetchWallets, fetchTournamentPeriodWinners, claimDailyLogin, playerStandingRemote, fetchGameStats, claimChallengeRemote, fetchActivityFeed, markNotificationsRead, refreshPortalRemote } from '../platform/backend';
import {
  activeTournaments, tournamentGame, getTournamentForGame, getLiveTournamentByCadence,
  countdown, loadTournaments, loadMyEntries,
  tournamentState, enterTournament,
  type Tournament, type LeaderEntry,
} from '../platform/tournaments';
import { balance, balanceSync, onWalletChange, setBalanceFromServer } from '../platform/wallet';
import { onCurrencyChange, setBalance, setLifetime, setRpWeekly, setRpMonthly, xpLifetime, rpWeekly, rpMonthly } from '../platform/currency';
import { orderedCatalog, getGame, freeGamesInCategory, trendingGames, recentlyAddedGames, ratingFor, estMinutesFor, COMING_SOON, type GameMeta, type TournamentCadence, type GameCategory } from '../platform/catalog';
import { getSupabase, isConfigured } from '../platform/supabase';
import { bootstrapHubData, type HubBootstrapResult } from '../platform/hubBootstrap';
import {
  escapeHtml, fmtPlayCount, starsHtml, gamesToolbarHtml,
  featuredTournamentBannerHtml, featuredTournamentsHtml, dailyChallengeHtml, sidebarDashboardHtml,
  dailyMissionsHtml, nextRewardHtml, newsFeedHtml, sidebarNewsHtml,
  lbPreviewRow, hScrollShelf, comingSoonShelfHtml, continuePlayingHtml,
  activityTickerHtml, notificationsPanelHtml, shelfSkeletonHtml, lbSkeletonHtml,
  gridSkeletonHtml, cpSkeletonHtml, bannerSkeletonHtml,
} from './portalSections';
import { getHowToGuide } from './howToGuides';
import {
  loadBrowseState, saveBrowseState, collectHScrollPositions,
  restoreHScrollPositions, restoreFocusedCard, findGameCard, type HubBrowseSnapshot,
} from './browseState';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const lang = (): Lang => getLang();
const name = (g: GameMeta): string => (lang() === 'am' ? g.nameAm : g.nameEn);
const genre = (g: GameMeta): string => (lang() === 'am' ? g.genreAm : g.genreEn);
const tTitle = (x: Tournament): string => (lang() === 'am' ? x.titleAm : x.titleEn);

/** Server play counts per game — hydrated after bootstrap. */
let gamePlayCounts: Record<string, number> = {};
/** Personal bests per game — filled on demand for enriched cards. */
const userBests: Record<string, number> = {};

// --- Promo banner carousel --------------------------------------------------
interface PromoSlide { img: string; alt: string; href?: string }
const PROMOS_FALLBACK: PromoSlide[] = [
  { img: '/brand/ad-banner-1.png', alt: 'Every Score Counts — climb the leaderboard', href: '#games' },
  { img: '/brand/ad-banner-2.png', alt: 'Weekly Fruit Slice Tournament', href: '#featuredTournaments' },
  { img: '/brand/ad-banner-3.png', alt: 'Monthly Memory Match Tournament', href: '#featuredTournaments' },
  { img: '/brand/ad-banner-4.png', alt: 'Win up to 50,000 ETB — Monthly & Weekly Tournaments', href: '#featuredTournaments' },
];
function promosFromConfig(): PromoSlide[] {
  const portal = config().portal;
  if (!portal?.promos?.length) return PROMOS_FALLBACK;
  return portal.promos.map((p) => ({
    img: p.img,
    alt: lang() === 'am' ? p.altAm : p.altEn,
    href: p.href,
  }));
}
let promoIdx = 0;
const PROMO_INTERVAL_MS = 4500;

function promoSlideHtml(p: PromoSlide, extraClass = ''): string {
  const cls = `promo-slide promo-slide-img${extraClass ? ` ${extraClass}` : ''}`;
  const img = `<img src="${escapeHtml(p.img)}" alt="" class="promo-banner-img" loading="lazy" decoding="async" />`;
  const overlay = p.href
    ? `<div class="promo-slide-overlay">
        <p class="promo-slide-caption">${escapeHtml(p.alt)}</p>
        <span class="promo-slide-cta">${t('hub.playNow')}</span>
      </div>`
    : `<div class="promo-slide-overlay promo-slide-overlay--static">
        <p class="promo-slide-caption">${escapeHtml(p.alt)}</p>
      </div>`;
  const media = `<div class="promo-slide-media">${img}${overlay}</div>`;
  if (p.href) {
    return `<a href="${escapeHtml(p.href)}" class="${cls}" aria-label="${escapeHtml(p.alt)}">${media}</a>`;
  }
  return `<div class="${cls}" role="img" aria-label="${escapeHtml(p.alt)}">${media}</div>`;
}

function resetPromoProgress(): void {
  const fill = document.querySelector<HTMLElement>('#promoProgressFill');
  if (!fill) return;
  fill.style.animation = 'none';
  void fill.offsetWidth;
  fill.style.animation = `promo-progress ${PROMO_INTERVAL_MS}ms linear forwards`;
}

function renderPromo(animate = false): void {
  const promos = promosFromConfig();
  const stage = document.querySelector('#promoSlideStage');
  const dots = document.querySelector('#promoDots');
  const section = document.querySelector('#promo');
  if (!stage || !dots || !promos.length) return;

  const idx = promoIdx % promos.length;
  const p = promos[idx];
  const nextHtml = promoSlideHtml(p, animate ? 'promo-slide-enter' : '');

  if (!animate || !stage.firstElementChild) {
    stage.innerHTML = nextHtml;
  } else {
    const current = stage.firstElementChild as HTMLElement;
    current.classList.add('promo-slide-exit');
    stage.insertAdjacentHTML('beforeend', nextHtml);
    const incoming = stage.lastElementChild as HTMLElement;
    requestAnimationFrame(() => {
      incoming.classList.add('promo-slide-enter-active');
    });
    window.setTimeout(() => {
      if (current.parentElement === stage) current.remove();
      incoming.classList.remove('promo-slide-enter', 'promo-slide-enter-active');
    }, 320);
  }

  dots.innerHTML = promos.map((_, i) =>
    `<button type="button" class="promo-dot${i === idx ? ' on' : ''}" aria-label="Slide ${i + 1}"></button>`,
  ).join('');
  section?.classList.toggle('promo-section--solo', promos.length <= 1);
  resetPromoProgress();
}

function advancePromo(): void {
  const n = promosFromConfig().length || 1;
  promoIdx = (promoIdx + 1) % n;
  renderPromo(true);
}

// Auto-advance timer the player can interrupt by swiping/tapping a dot.
let promoTimer: ReturnType<typeof setInterval> | undefined;
function restartPromoTimer(): void {
  if (promoTimer) clearInterval(promoTimer);
  const n = promosFromConfig().length;
  if (n <= 1) return;
  promoTimer = setInterval(advancePromo, PROMO_INTERVAL_MS);
}
function goToPromo(i: number): void {
  const n = promosFromConfig().length || 1;
  const next = (i + n) % n;
  if (next === promoIdx % n) return;
  promoIdx = next;
  renderPromo(true);
  restartPromoTimer();
}

// Manual control: swipe left/right on the banner, or tap a dot.
function setupPromo(): void {
  const track = document.querySelector<HTMLElement>('#promoTrack');
  const dots = document.querySelector<HTMLElement>('#promoDots');
  const section = document.querySelector<HTMLElement>('#promo');
  dots?.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>('.promo-dot');
    if (!dot || !dot.parentElement) return;
    goToPromo([...dot.parentElement.children].indexOf(dot));
  });
  if (track) {
    let startX = 0; let active = false;
    track.addEventListener('pointerdown', (e) => { active = true; startX = e.clientX; });
    track.addEventListener('pointerup', (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40) goToPromo(promoIdx + (dx < 0 ? 1 : -1));
    });
    track.addEventListener('pointercancel', () => { active = false; });
    track.style.touchAction = 'pan-y';
  }
  section?.addEventListener('mouseenter', () => {
    if (promoTimer) clearInterval(promoTimer);
    const fill = document.querySelector<HTMLElement>('#promoProgressFill');
    if (fill) fill.style.animationPlayState = 'paused';
  });
  section?.addEventListener('mouseleave', () => {
    const fill = document.querySelector<HTMLElement>('#promoProgressFill');
    if (fill) fill.style.animationPlayState = 'running';
    restartPromoTimer();
  });
}

// --- Live tournament leaderboards (weekly / monthly) -------------------------
let liveCadence: TournamentCadence = 'weekly';
/** Set when #topPlayers enters the viewport — gates the initial leaderboard fetch. */
let liveBoardSeen = false;

function tourLbRow(r: LeaderEntry): string {
  const medal = ['🥇', '🥈', '🥉'];
  const rp = r.rp ?? r.score;
  const rpStr = typeof rp === 'number' ? fmtRp(rp) : String(rp);
  return `
    <div class="lb-row${r.rank <= 3 ? ' top' : ''}${r.isPlayer ? ' me' : ''}">
      <span class="lb-rank">${medal[r.rank - 1] ?? r.rank}</span>
      <span class="lb-name">${escapeHtml(r.isPlayer ? t('td.you') : r.name)}</span>
      <span class="lb-score">${rpStr} RP</span>
    </div>`;
}

function renderLiveBoard(opts?: { fetch?: boolean }): void {
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
  const mayFetch = opts?.fetch ?? liveBoardSeen;
  if (!mayFetch) return;
  void Promise.all([leaderboardRemote(tour.id, 10), playerStandingRemote(tour.id)]).then(([rows, me]) => {
    const playerInBoard = rows.some((r) => r.isPlayer);
    let html = rows.length
      ? rows.map(tourLbRow).join('')
      : `<p class="pd-empty">${t('hub.noBoardYet')}</p>`;
    if (me && !playerInBoard) {
      html += `<div class="lb-sep" aria-hidden="true"></div>${tourLbRow({ ...me, isPlayer: true, rp: me.rp })}`;
    }
    host.innerHTML = html;
  });
}

function setupLiveBoardTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('#liveBoardSeg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      liveCadence = (b.dataset.cadence as TournamentCadence) ?? 'daily';
      document.querySelectorAll('#liveBoardSeg .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderLiveBoard({ fetch: true });
    });
  });
}

// --- Player balance bar -----------------------------------------------------
// Level / XP / Weekly RP / Monthly RP chips under the promo banner.
function fmtRp(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

/** Pull W-RP / M-RP from the live fruit-slice weekly + memory-match monthly boards. */
async function refreshPlayerRp(): Promise<void> {
  const weeklyTour = getLiveTournamentByCadence('weekly');
  const monthlyTour = getLiveTournamentByCadence('monthly');
  const [weeklyMe, monthlyMe] = await Promise.all([
    weeklyTour ? playerStandingRemote(weeklyTour.id) : Promise.resolve(undefined),
    monthlyTour ? playerStandingRemote(monthlyTour.id) : Promise.resolve(undefined),
  ]);
  setRpWeekly(weeklyMe?.rp ?? 0);
  setRpMonthly(monthlyMe?.rp ?? 0);
}

function xpLevelBounds(lifetimeXp: number): { level: number; floor: number; ceiling: number } {
  const xp = Math.max(0, lifetimeXp);
  const level = levelFor(xp);
  const floor = level <= 10
    ? LEVEL_THRESHOLDS[level - 1] ?? 0
    : 6000 + (level - 10) * 3000;
  const ceiling = level < 10
    ? LEVEL_THRESHOLDS[level] ?? floor + 3000
    : 6000 + (level - 9) * 3000;
  return { level, floor, ceiling };
}

function renderMyStats(): void {
  const bar = document.querySelector('#playerBar');
  if (!bar) return;
  const xp = xpLifetime();
  const { level, floor, ceiling } = xpLevelBounds(xp);
  const span = Math.max(1, ceiling - floor);
  const pct = Math.min(100, Math.round(((xp - floor) / span) * 100));
  const nextXp = ceiling;

  bar.innerHTML = `
    <div class="player-strip">
      <div class="ps-seg ps-level">
        <span class="ps-ico" aria-hidden="true">🛡️</span>
        <span class="ps-lbl">${t('hub.statLevel')}</span>
        <strong class="ps-val">${level}</strong>
      </div>
      <div class="ps-seg ps-rp ps-rp-weekly">
        <span class="ps-ico" aria-hidden="true">🏅</span>
        <span class="ps-lbl">${t('hub.rpWeekly')}</span>
        <strong class="ps-val">${fmtRp(rpWeekly())}</strong>
      </div>
      <div class="ps-seg ps-rp ps-rp-monthly">
        <span class="ps-ico" aria-hidden="true">🏆</span>
        <span class="ps-lbl">${t('hub.rpMonthly')}</span>
        <strong class="ps-val">${fmtRp(rpMonthly())}</strong>
      </div>
      <div class="ps-seg ps-xp">
        <span class="ps-ico" aria-hidden="true">⭐</span>
        <span class="ps-lbl">${t('hub.progress')}</span>
        <div class="ps-bar-wrap">
          <div class="ps-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="ps-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="ps-sub">${xp.toLocaleString()} / ${nextXp.toLocaleString()}</span>
        </div>
      </div>
    </div>`;

  const host = document.querySelector('#topBalances');
  if (host) host.innerHTML = '';
}

// --- Tournament entry economy (confirm flow) --------------------------------

// Attach handlers to register buttons / play links inside a freshly-rendered root.
function wireEntryCtas(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) => {
    b.addEventListener('click', async () => {
      const tour = activeTournaments().find((x) => x.id === b.dataset.enter);
      const game = tour ? tournamentGame(tour) : undefined;
      if (!tour || !game) return;
      try {
        await enterTournament(tour.id);
        renderAll();
        if (game.route) window.location.assign(game.route);
      } catch { /* session expiry etc. handled by signInGate */ }
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => {
    a.addEventListener('click', () => { void enterTournament(a.dataset.play!).catch(() => {}); });
  });
}

// --- Games library (flat, ordered) ------------------------------------------
// The category shown on a card = the first token of its genre ("Chance · …").
const category = (g: GameMeta): string => genre(g).split('·')[0].trim();

function howToStepsHtml(g: GameMeta): string {
  const guide = getHowToGuide(g.id, g.nameEn, g.nameAm);
  const am = lang() === 'am';
  const goal = am ? guide.goalAm : guide.goalEn;
  const steps = am ? guide.stepsAm : guide.stepsEn;
  const items = steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `<p class="howto-goal">${escapeHtml(goal)}</p><ol class="howto-steps">${items}</ol>`;
}


/** Default catalog art when a game has no explicit `cover`. */
const GAME_COVER: Record<string, string> = {
  'orbit-blast': '/orbit_blast.webp',
  'merge-2048': '/merge_2048.webp',
  'temple-dash': '/temple_dash.webp',
  'candy-crunch': '/candy_saga.webp',
  'brick-blitz': '/brick_blitz.webp',
  'fruit-slice': '/fruit_slice.webp',
  'sky-hopper': '/sky_hopper.webp',
  'bubble-pop': '/bubble_pop.webp',
  'memory-match': '/memory_match.webp',
  'tap-game': '/tap_game.webp',
  'lucky-box': '/lucky_boxes.webp',
  'spin-wheel': '/spin_wheel.webp',
  'luckyslot': '/lucky_slot.webp',
  'popblast': '/candy_blast.webp',
  'ethiopian-quiz': '/ethiopian_quiz.webp',
  'sudoku': '/sudoku.webp',
  'spell': '/spell_quiz.webp',
  'vocab': '/vocabulary_trivia.webp',
  'rhyme': '/rhyme_time.webp',
  'target24': '/target_24.webp',
  'crosssum': '/cross_sum.webp',
  'logic': '/logic_grid.webp',
  'sequence': '/sequence.webp',
  'water-sort': '/water_sort.webp',
  'parking-jam': '/parking_jam.webp',
  'laser-puzzle': '/laser_puzzle.webp',
  'piano-tiles': '/piano_tiles.webp',
  'stack-tower': '/stack_tower.webp',
  'crossy-road': '/crossy_road.webp',
  'block-blast': '/block_blast.webp',
  'tile-connect': '/tile_connect.webp',
  'hexa-block': '/hexa_block.webp',
  'knife-hit': '/knife_hit.webp',
  'helix-jump': '/helix_jump.webp',
  'hill-climb': '/hill_climb.webp',
  'tower-defense': '/tower_defense.webp',
  'draw-bridge': '/draw_bridge.webp',
  'ball-sort': '/ball_sort.webp',
  'jewel-match': '/jewel_match.webp',
  'reflex-tap': '/reflex_tap.webp',
  'doodle-jump': '/doodle_jump.webp',
  'zigzag': '/zigzag.webp',
  'color-switch': '/color_switch.webp',
  'rope-rescue': '/rope_rescue.webp',
  'pipe-connect': '/pipe_connect.webp',
  'ball-maze': '/ball_maze.webp',
  'arrow-shot': '/arrow_shot.webp',
  'slide-puzzle': '/slide_puzzle.webp',
  'race-car': '/race_car.webp',
};

function gameCover(g: GameMeta): string | undefined {
  return g.cover ?? GAME_COVER[g.id];
}

function cadenceKey(g: GameMeta): TournamentCadence | 'free' {
  if (g.mode !== 'tournament') return 'free';
  return g.tournament ?? 'monthly';
}

function cadenceRibbon(g: GameMeta): string {
  const cadence = cadenceKey(g);
  if (cadence === 'free') {
    return `<span class="gc-ribbon gc-ribbon--free">🎮 ${t('arc.free')}</span>`;
  }
  const label = t(cadence === 'daily' ? 'td.daily' : cadence === 'weekly' ? 'td.weekly' : 'td.monthly');
  return `<span class="gc-ribbon gc-ribbon--${cadence}">🏆 ${label}</span>`;
}

function cadenceSubtitle(g: GameMeta): string {
  const cadence = cadenceKey(g);
  if (cadence === 'free') return escapeHtml(category(g));
  if (cadence === 'weekly') return t('hub.weeklyTournament');
  if (cadence === 'daily') return t('hub.dailyTournament');
  return t('hub.monthlyTournament');
}

function topPrizeBadge(g: GameMeta): string {
  const prizes = TOURNAMENT_ETB_PRIZES[g.id];
  if (!prizes?.length) return '';
  const top = formatEtbPrize(prizes[0], lang());
  const cadence = g.tournament ?? 'monthly';
  return `<span class="gc-prize-badge gc-prize-badge--${cadence}">${t('hub.topPrize')} ${escapeHtml(top)}</span>`;
}

function badgeTag(g: GameMeta): string {
  if (g.badge === 'hot') return `<span class="gc-badge gc-badge--hot">HOT</span>`;
  if (g.badge === 'new') return `<span class="gc-badge gc-badge--new">NEW</span>`;
  return '';
}

function tournamentPoolEtb(g: GameMeta): number {
  const prizes = TOURNAMENT_ETB_PRIZES[g.id] ?? etbPrizesForCadence(g.tournament ?? 'monthly');
  return prizes.reduce((s, p) => s + p, 0);
}

function tournamentCardMeta(g: GameMeta, tour: Tournament | undefined): string {
  if (g.mode !== 'tournament' || !tour) return gameCardStats(g);
  const pool = tournamentPoolEtb(g);
  const poolStr = pool > 0 ? formatEtbPrize(pool, lang()) : '—';
  const online = getOnlineCount();
  const onlineStr = t('hub.onlinePlayers').replace('{n}', online > 0 ? fmtPlayCount(online) : '0');
  return `
    <div class="gc-tour-meta">
      <div class="gc-tour-stat">
        <span class="gc-tour-lbl" data-i18n="td.prizePool">${t('td.prizePool')}</span>
        <strong class="gc-tour-val">${escapeHtml(poolStr)}</strong>
      </div>
      <div class="gc-tour-stat gc-tour-stat--countdown">
        <span class="gc-tour-lbl" data-i18n="hub.endsIn">${t('hub.endsIn')}</span>
        <strong class="gc-tour-val gc-countdown" data-ends="${tour.endsAt}">${escapeHtml(fmt(tour.endsAt))}</strong>
      </div>
      <div class="gc-tour-stat gc-tour-stat--online">
        <span class="gc-tour-lbl" data-i18n="hub.playersOnline">${t('hub.playersOnline')}</span>
        <strong class="gc-tour-val gc-tour-online">${escapeHtml(onlineStr)}</strong>
      </div>
    </div>`;
}

function gameCardStats(g: GameMeta): string {
  const plays = gamePlayCounts[g.id];
  const playStr = plays != null && plays > 0 ? fmtPlayCount(plays) : '—';
  const best = userBests[g.id];
  const bestStr = best != null && best > 0 ? best.toLocaleString() : '—';
  const rating = starsHtml(ratingFor(g));
  const mins = estMinutesFor(g);
  return `
    <div class="gc-stats">
      <span class="gc-stat" title="Rating"><span class="gc-stat-ico">⭐</span>${rating}</span>
      <span class="gc-stat" title="Plays"><span class="gc-stat-ico">👥</span>${playStr}</span>
      <span class="gc-stat" title="Duration"><span class="gc-stat-ico">⏱</span>${mins}m</span>
      <span class="gc-stat" title="High score"><span class="gc-stat-ico">🏆</span>${bestStr}</span>
    </div>`;
}

function gameCard(g: GameMeta, opts?: { compact?: boolean; animIndex?: number }): string {
  const cadence = cadenceKey(g);
  const cover = gameCover(g);
  const tour = g.mode === 'tournament' ? getTournamentForGame(g.id) : undefined;
  const liveBadge = tour && tournamentState(tour) === 'live'
    ? `<span class="gc-live live-dot">● ${t('hub.live')}</span>` : '';
  const thumbStyle = cover
    ? ''
    : ` style="background:linear-gradient(145deg,${g.thumb[0]},${g.thumb[1]})"`;
  const cardStyle = opts?.animIndex != null ? ` style="--card-i:${opts.animIndex}"` : '';
  const playLabel = g.mode === 'tournament' ? t('hub.joinNow') : t('hub.playNow');
  const thumb = `
      <div class="gc-thumb gc-thumb-cover"${thumbStyle}>
        ${cover
          ? `<img class="gc-cover" src="${cover}" alt="" loading="lazy" />`
          : `<span class="gc-glyph">${g.icon}</span>`}
        ${cadenceRibbon(g)}
        ${badgeTag(g)}
        ${liveBadge}
        ${g.mode === 'tournament' ? topPrizeBadge(g) : ''}
        <button type="button" class="gc-info" data-howto="${g.id}" aria-label="${t('hub.howToPlay')}">?</button>
      </div>`;
  return `
    <a class="game-card game-card--poster game-card--${cadence}${opts?.compact ? ' game-card--compact' : ''}" href="${g.route}" data-game-id="${g.id}"${cardStyle}>
      ${thumb}
      <div class="gc-body">
        <h4 class="gc-title">${escapeHtml(name(g))}</h4>
        <p class="gc-sub gc-sub--${cadence}">${cadenceSubtitle(g)}</p>
        ${tournamentCardMeta(g, tour)}
        <span class="gc-play-btn gc-play-btn--${cadence}">
          <span class="gc-play-label">${playLabel}</span>
          <span class="gc-play-arrow" aria-hidden="true">▶</span>
        </span>
      </div>
    </a>`;
}

// "How to play" modal, opened by the ℹ️ button on a card. The button lives inside
// the card's <a>, so we stop the click from navigating.
function openHowToModal(title: string, bodyHtml: string): void {
  document.querySelector('.howto-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'howto-modal';
  m.innerHTML = `<div class="howto-scrim"></div>
    <div class="howto-card howto-card-rules">
      <button type="button" class="howto-x" aria-label="${t('hub.cancel')}">✕</button>
      <h3 class="howto-name">${title}</h3>
      <p class="howto-sub">📖 ${t('hub.howToPlay')}</p>
      <div class="howto-body">${bodyHtml}</div>
      <button type="button" class="btn ghost howto-close">${t('hub.cancel')}</button>
    </div>`;
  document.body.appendChild(m);
  const close = (): void => m.remove();
  m.querySelector('.howto-scrim')!.addEventListener('click', close);
  m.querySelector('.howto-close')!.addEventListener('click', close);
  m.querySelector('.howto-x')!.addEventListener('click', close);
}

function openHowTo(g: GameMeta): void {
  openHowToModal(`${g.icon} ${escapeHtml(name(g))}`, howToStepsHtml(g));
}

function openComingSoonHowTo(id: string): void {
  const teaser = COMING_SOON.find((c) => c.id === id);
  if (!teaser) return;
  const guide = getHowToGuide(id, teaser.nameEn, teaser.nameAm);
  const am = lang() === 'am';
  const goal = am ? guide.goalAm : guide.goalEn;
  const steps = am ? guide.stepsAm : guide.stepsEn;
  const items = steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const body = `<p class="howto-goal">${escapeHtml(goal)}</p><ol class="howto-steps">${items}</ol>`;
  const title = escapeHtml(am ? teaser.nameAm : teaser.nameEn);
  openHowToModal(`${teaser.icon} ${title}`, body);
}

// Browse state: segmented menu filters by tournament / free (default: tournament).
let browseSnapshot = loadBrowseState();
let gameFilter: 'tournament' | 'free' = browseSnapshot?.gameFilter ?? 'tournament';
let categoryFilter: GameCategory | 'all' = browseSnapshot?.categoryFilter ?? 'all';
let gameQuery = browseSnapshot?.gameQuery ?? '';

function persistBrowseState(opts?: { focusedGameId?: string }): void {
  const snapshot: HubBrowseSnapshot = {
    gameFilter,
    categoryFilter,
    gameQuery,
    scrollY: window.scrollY,
    hScrollPositions: collectHScrollPositions(),
    focusedGameId: opts?.focusedGameId ?? browseSnapshot?.focusedGameId,
  };
  browseSnapshot = snapshot;
  saveBrowseState(snapshot);
}

function wireHScrollPersistence(): void {
  for (const id of ['trendingShelf', 'recentShelf']) {
    const track = document.getElementById(id)?.querySelector<HTMLElement>('.hscroll-track');
    if (!track || track.dataset.browseWired) continue;
    track.dataset.browseWired = '1';
    let timer: ReturnType<typeof setTimeout> | undefined;
    track.addEventListener('scroll', () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        persistBrowseState();
      }, 100);
    }, { passive: true });
  }
}

function restoreBrowseViewport(): boolean {
  if (!browseSnapshot?.focusedGameId) return false;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const { scrollY, hScrollPositions, focusedGameId } = browseSnapshot;
  if (!findGameCard(focusedGameId)) return false;

  restoreHScrollPositions(hScrollPositions);
  if (scrollY > 0) window.scrollTo(0, scrollY);
  restoreFocusedCard(focusedGameId);

  browseSnapshot = {
    ...browseSnapshot,
    focusedGameId: undefined,
    scrollY: window.scrollY,
    hScrollPositions: collectHScrollPositions(),
  };
  saveBrowseState(browseSnapshot);
  return true;
}

function scheduleBrowseViewportRestore(): void {
  if (!browseSnapshot?.focusedGameId) return;
  const attempt = (): void => {
    if (restoreBrowseViewport()) return;
    window.setTimeout(() => restoreBrowseViewport(), 400);
  };
  requestAnimationFrame(() => requestAnimationFrame(attempt));
}

// A single flat library (no category sections), ordered by the catalog's
// preferred order, filtered by the tag menu + search.
let gamesGridMounted = false;

function renderGames(): void {
  const host = $('#gameGrid');
  const q = gameQuery.trim().toLowerCase();
  let pool: GameMeta[];
  if (q) {
    pool = orderedCatalog().filter((g) =>
      `${g.nameEn} ${g.nameAm} ${g.genreEn} ${g.genreAm}`.toLowerCase().includes(q));
  } else if (gameFilter === 'tournament') {
    pool = orderedCatalog().filter((g) => g.mode === 'tournament');
  } else {
    pool = freeGamesInCategory(categoryFilter);
  }
  const animate = gamesGridMounted;
  gamesGridMounted = true;
  host.innerHTML = pool.length
    ? `<div class="cat-shelf${animate ? ' is-filtering' : ''}">${pool.map((g, i) =>
      gameCard(g, { animIndex: animate ? i : undefined }),
    ).join('')}</div>`
    : `<p class="cat-empty">${t('hub.noResults')}</p>`;
  if (animate) {
    requestAnimationFrame(() => host.querySelector('.cat-shelf')?.classList.remove('is-filtering'));
  }
  wireHScrollPersistence();
}

function syncSearchFieldUi(input?: HTMLInputElement | null): void {
  const search = input ?? document.querySelector<HTMLInputElement>('#gameSearch');
  const wrap = document.querySelector<HTMLElement>('#gameSearchWrap');
  const clear = document.querySelector<HTMLButtonElement>('#gameSearchClear');
  if (!search || !wrap) return;
  const hasValue = search.value.length > 0;
  wrap.classList.toggle('has-value', hasValue);
  if (clear) clear.hidden = !hasValue;
}

function wireSearchField(): void {
  const search = document.querySelector<HTMLInputElement>('#gameSearch');
  const clear = document.querySelector<HTMLButtonElement>('#gameSearchClear');
  const wrap = document.querySelector<HTMLElement>('#gameSearchWrap');
  if (!search || !wrap) return;

  search.placeholder = t('hub.searchGamesPremium');
  syncSearchFieldUi(search);

  search.addEventListener('focus', () => wrap.classList.add('is-focused'));
  search.addEventListener('blur', () => wrap.classList.remove('is-focused'));

  clear?.addEventListener('click', () => {
    gameQuery = '';
    search.value = '';
    syncSearchFieldUi(search);
    renderGames();
    persistBrowseState();
    search.focus();
  });
}

function renderGamesToolbar(): void {
  const host = document.querySelector('#gamesToolbarHost');
  if (!host) return;
  const prevSearch = document.querySelector<HTMLInputElement>('#gameSearch');
  const focusSearch = prevSearch === document.activeElement;
  const selStart = prevSearch?.selectionStart ?? null;
  host.innerHTML = gamesToolbarHtml({
    gameFilter,
    categoryFilter,
    langCode: lang(),
    searchQuery: gameQuery,
  });
  const search = host.querySelector<HTMLInputElement>('#gameSearch');
  if (search) {
    if (focusSearch) {
      search.focus();
      if (selStart != null) search.setSelectionRange(selStart, selStart);
    }
  }
  wireSearchField();
  wirePillTabsIndicator();
}

let pillTabsResizeObserver: ResizeObserver | undefined;
let pillTabsWindowResizeWired = false;

function updatePillIndicator(): void {
  const seg = document.querySelector<HTMLElement>('#gameSeg');
  const indicator = seg?.querySelector<HTMLElement>('.pill-tabs-indicator');
  const active = seg?.querySelector<HTMLElement>('.pill-tab.active');
  if (!indicator || !active) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function wirePillTabsIndicator(): void {
  requestAnimationFrame(() => {
    updatePillIndicator();
    const seg = document.querySelector('#gameSeg');
    if (!seg) return;
    pillTabsResizeObserver?.disconnect();
    pillTabsResizeObserver = new ResizeObserver(() => updatePillIndicator());
    pillTabsResizeObserver.observe(seg);
    if (!pillTabsWindowResizeWired) {
      pillTabsWindowResizeWired = true;
      window.addEventListener('resize', () => updatePillIndicator(), { passive: true });
    }
  });
}

// --- Portal sections (Phase 1) ----------------------------------------------
let lbPreviewSeen = false;

function renderTrending(): void {
  const host = document.querySelector('#trendingShelf');
  if (!host) return;
  const portal = config().portal;
  const mode = portal?.trendingMode ?? 'analytics';
  const analyticsIds = getAnalyticsTrendingIds();
  if (mode === 'analytics' && analyticsIds.length) {
    // Server 7-day (or all-time fallback) order — treat as curated list.
    host.innerHTML = hScrollShelf(
      trendingGames(analyticsIds, undefined, 'curated'),
      (g) => gameCard(g, { compact: true }),
    );
    wireHScrollPersistence();
    return;
  }
  host.innerHTML = hScrollShelf(
    trendingGames(portal?.trendingGameIds, gamePlayCounts, mode),
    (g) => gameCard(g, { compact: true }),
  );
  wireHScrollPersistence();
}

function renderRecentlyAdded(): void {
  const host = document.querySelector('#recentShelf');
  if (!host) return;
  const ids = config().portal?.recentlyAddedGameIds;
  host.innerHTML = hScrollShelf(recentlyAddedGames(ids), (g) => gameCard(g, { compact: true }));
  wireHScrollPersistence();
}

function progressPctForGame(g: GameMeta, score: number): number {
  const par = g.play?.winScore ?? 1000;
  return Math.min(100, Math.max(5, Math.round((score / Math.max(1, par)) * 100)));
}

function renderContinuePlaying(): void {
  const section = document.querySelector<HTMLElement>('#continuePlaying');
  const host = document.querySelector('#continueShelf');
  if (!section || !host) return;
  const recent = getRecentGames();
  const rows = recent
    .map((r) => {
      const game = getGame(r.gameId);
      if (!game) return null;
      userBests[game.id] = r.lastScore;
      return {
        game,
        lastScore: r.lastScore,
        progressPct: progressPctForGame(game, r.lastScore),
        lastPlayedAt: r.lastPlayedAt,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!rows.length) {
    if (hubHydrating) {
      section.hidden = false;
      if (!host.querySelector('.cp-skel-list')) host.innerHTML = cpSkeletonHtml(2);
      return;
    }
    section.hidden = true;
    host.innerHTML = '';
    return;
  }
  section.hidden = false;
  host.innerHTML = continuePlayingHtml(lang(), rows);
  requestAnimationFrame(() => {
    host.querySelectorAll<HTMLElement>('.cp-progress-fill').forEach((el) => {
      const pct = el.dataset.pct ?? '0';
      el.style.width = '0%';
      requestAnimationFrame(() => { el.style.width = `${pct}%`; });
    });
  });
}

function renderComingSoon(): void {
  const host = document.querySelector('#comingSoonShelf');
  if (!host) return;
  host.innerHTML = comingSoonShelfHtml(lang());
}

/** True while the initial server bootstrap is in flight — drives skeleton placeholders. */
let hubHydrating = isConfigured();

function renderFeaturedTournaments(): void {
  const host = document.querySelector('#featuredTournamentsHost');
  const section = document.querySelector<HTMLElement>('#featuredTournaments');
  if (!host || !section) return;
  const cards: string[] = [];
  for (const cadence of ['weekly', 'monthly'] as const) {
    const tour = getLiveTournamentByCadence(cadence);
    const game = tour ? getGame(tour.gameId) : undefined;
    if (!tour || !game) continue;
    cards.push(featuredTournamentBannerHtml({
      cadence,
      lang: lang(),
      gameName: name(game),
      gameIcon: game.icon,
      gameRoute: game.route,
      gameId: game.id,
      tour,
      title: tTitle(tour),
    }));
  }
  if (!cards.length) {
    if (hubHydrating) {
      section.hidden = false;
      if (!host.querySelector('.skel-banner-grid')) host.innerHTML = bannerSkeletonHtml(2);
      return;
    }
    section.hidden = true;
    host.innerHTML = '';
    return;
  }
  section.hidden = false;
  host.innerHTML = featuredTournamentsHtml(cards);
}

function renderSidebar(): void {
  const xp = xpLifetime();
  const { level, floor, ceiling } = xpLevelBounds(xp);
  const span = Math.max(1, ceiling - floor);
  const pct = Math.min(100, Math.round(((xp - floor) / span) * 100));
  const xpToNext = Math.max(0, ceiling - xp);
  const challenge = getChallengeProgress();

  const challengeHost = document.querySelector('#sidebarChallenge');
  if (challengeHost) {
    challengeHost.innerHTML = dailyChallengeHtml(challenge);
    challengeHost.querySelector('#claimChallengeBtn')?.addEventListener('click', () => {
      void claimChallengeRemote().then((res) => {
        if (!res) return;
        if (res.award > 0) setBalanceFromServer(res.coins);
        setChallengeProgress(parseChallengePayload(res.challenge));
        renderSidebar();
        renderMyStats();
      });
    });
  }

  const dash = document.querySelector('#sidebarDashboard');
  if (dash) {
    dash.innerHTML = sidebarDashboardHtml({
      level,
      xpPct: pct,
      xp,
      nextXp: ceiling,
      coins: balanceSync(),
      gamesPlayed: getGamesPlayedToday() || getRecentGames().length,
      rank: getWeeklyRank(),
    });
  }

  const missions = document.querySelector('#sidebarMissions');
  if (missions) missions.innerHTML = dailyMissionsHtml(challenge);

  const next = document.querySelector('#sidebarNextReward');
  if (next) next.innerHTML = nextRewardHtml(level, xpToNext, pct);

  const news = document.querySelector('#sidebarNews');
  if (news) news.innerHTML = sidebarNewsHtml(lang());

  renderNotifBadge();
}

function renderActivityTicker(): void {
  const host = document.querySelector('#activityTickerHost');
  if (!host) return;
  const items = getActivityFeed();
  host.innerHTML = activityTickerHtml(items, lang(), getOnlineCount());
  const track = host.querySelector<HTMLElement>('.activity-ticker-track');
  if (track) {
    requestAnimationFrame(() => {
      const scrollDist = track.scrollWidth / 2;
      const durationSec = Math.min(240, Math.max(90, scrollDist / 22));
      track.style.animationDuration = `${durationSec}s`;
    });
  }
}

function renderNotifBadge(): void {
  const bell = document.querySelector<HTMLButtonElement>('#notifBell');
  const badge = document.querySelector<HTMLElement>('#notifBadge');
  if (!bell || !badge) return;
  const n = unreadNotifCount();
  bell.hidden = !isConfigured();
  if (n > 0) {
    badge.hidden = false;
    badge.textContent = n > 9 ? '9+' : String(n);
  } else {
    badge.hidden = true;
  }
}

function parseChallengePayload(raw: unknown): ChallengeProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    rewardCoins: Number(o.rewardCoins ?? 200),
    claimed: Boolean(o.claimed),
    allDone: Boolean(o.allDone),
    tasks: Array.isArray(o.tasks) ? o.tasks as ChallengeProgress['tasks'] : [],
    missions: Array.isArray(o.missions) ? o.missions as ChallengeProgress['missions'] : [],
  };
}

function renderNews(): void {
  const host = document.querySelector('#newsHost');
  if (!host) return;
  host.innerHTML = newsFeedHtml(lang());
}

function renderLbPreview(opts?: { fetch?: boolean }): void {
  const host = document.querySelector('#lbPreviewBoard');
  if (!host) return;
  const mayFetch = opts?.fetch ?? lbPreviewSeen;
  if (!mayFetch) {
    if (!host.innerHTML.trim()) host.innerHTML = lbSkeletonHtml(3);
    return;
  }
  const tour = getLiveTournamentByCadence('weekly');
  if (!tour) {
    host.innerHTML = `<p class="pd-empty">${t('hub.noBoardYet')}</p>`;
    return;
  }
  if (!host.querySelector('.lb-preview-row')) host.innerHTML = lbSkeletonHtml(3);
  void Promise.all([leaderboardRemote(tour.id, 3), playerStandingRemote(tour.id)]).then(([rows, me]) => {
    const playerInBoard = rows.some((r) => r.isPlayer);
    let html = rows.length
      ? rows.map(lbPreviewRow).join('')
      : `<p class="pd-empty">${t('hub.noBoardYet')}</p>`;
    if (me && !playerInBoard) {
      html += lbPreviewRow({ ...me, isPlayer: true, rp: me.rp });
    }
    host.innerHTML = html;
  });
}

function renderPortalSections(): void {
  renderFeaturedTournaments();
  renderTrending();
  renderContinuePlaying();
  renderSidebar();
  renderActivityTicker();
  renderRecentlyAdded();
  renderNews();
  renderComingSoon();
  renderLbPreview({ fetch: lbPreviewSeen });
}

/** First paint placeholders before bootstrap returns. */
function paintSkeletons(): void {
  const grid = document.querySelector('#gameGrid');
  if (grid && !grid.innerHTML.trim()) grid.innerHTML = gridSkeletonHtml(8);

  const trending = document.querySelector('#trendingShelf');
  if (trending && !trending.innerHTML.trim()) trending.innerHTML = shelfSkeletonHtml(4);
  const recent = document.querySelector('#recentShelf');
  if (recent && !recent.innerHTML.trim()) recent.innerHTML = shelfSkeletonHtml(4);
  const lb = document.querySelector('#lbPreviewBoard');
  if (lb && !lb.innerHTML.trim()) lb.innerHTML = lbSkeletonHtml(3);

  const continueSection = document.querySelector<HTMLElement>('#continuePlaying');
  const continueHost = document.querySelector('#continueShelf');
  if (continueHost && !continueHost.innerHTML.trim()) {
    continueHost.innerHTML = cpSkeletonHtml(2);
    if (continueSection) continueSection.hidden = false;
  }

  const featuredHost = document.querySelector('#featuredTournamentsHost');
  const featuredSection = document.querySelector<HTMLElement>('#featuredTournaments');
  if (featuredHost && !featuredHost.innerHTML.trim()) {
    featuredHost.innerHTML = bannerSkeletonHtml(2);
    if (featuredSection) featuredSection.hidden = false;
  }
}

// Winners tab: weekly / monthly ETB prizes for the latest tournament window.
let winnerCadence: WinnerCadence = 'weekly';
/** Set when #winners enters the viewport — gates the initial winners fetch. */
let winnersSeen = false;

function formatEtbPrizeHub(amount: number): string {
  return formatEtbPrize(amount, lang());
}

function winnerPrizeForRank(cadence: WinnerCadence, rank: number): string {
  const prizes = etbPrizesForCadence(cadence);
  const etb = rank >= 1 && rank <= prizes.length ? prizes[rank - 1] : 0;
  return etb > 0 ? formatEtbPrizeHub(etb) : '—';
}

function renderWinners(opts?: { fetch?: boolean }): void {
  const tbody = document.querySelector('#winnerList');
  if (!tbody) return;
  const mayFetch = opts?.fetch ?? winnersSeen;
  if (!mayFetch) return;

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
      renderWinners({ fetch: true });
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
  document.querySelectorAll<HTMLElement>('.tc-count').forEach((el) => {
    const end = Number(el.dataset.ends);
    el.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <strong>${fmt(end)}</strong>`;
  });
  document.querySelectorAll<HTMLElement>('strong[data-ends]').forEach((el) => {
    el.textContent = fmt(Number(el.dataset.ends));
  });
  document.querySelectorAll<HTMLElement>('.gc-countdown[data-ends], .wb-countdown[data-ends]').forEach((el) => {
    el.textContent = fmt(Number(el.dataset.ends));
    el.classList.add('is-ticking');
    window.setTimeout(() => el.classList.remove('is-ticking'), 360);
  });
}

// --- Render all + language --------------------------------------------------
function renderAll(opts?: { skipGames?: boolean }): void {
  renderPromo();
  renderFeaturedTournaments();
  renderMyStats();
  renderGamesToolbar();
  wireEntryCtas();
  if (!opts?.skipGames) renderGames();
  renderPortalSections();
  renderLiveBoard({ fetch: liveBoardSeen });
  renderWinners({ fetch: winnersSeen });
  applyTranslations();
  wireSearchField();
  tickCountdowns();
}

// Load authoritative tournament config + the player's entries (online), then
// re-render so cards reflect real state. No-ops to local data offline.
async function refreshData(): Promise<void> {
  await Promise.all([loadTournaments(), loadMyEntries()]);
  wireEntryCtas();
  renderGames();
  renderLiveBoard({ fetch: liveBoardSeen });
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

function mountNotifications(): void {
  const btn = document.querySelector<HTMLButtonElement>('#notifBell');
  if (!btn) return;
  const panel = document.createElement('div');
  panel.className = 'notif-menu';
  panel.hidden = true;
  document.body.appendChild(panel);

  const close = (): void => { panel.hidden = true; };
  const position = (): void => {
    const r = btn.getBoundingClientRect();
    panel.style.top = `${r.bottom + 8}px`;
    const w = panel.offsetWidth || 300;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    panel.style.left = `${Math.max(8, left)}px`;
  };

  function build(): void {
    const items = getNotifications();
    panel.innerHTML = `
      <div class="notif-head">
        <strong data-i18n="hub.notifTitle">${t('hub.notifTitle')}</strong>
        <button type="button" class="notif-mark" id="notifMarkAll">${t('hub.notifMarkRead')}</button>
      </div>
      ${notificationsPanelHtml(items)}`;
    panel.querySelector('#notifMarkAll')?.addEventListener('click', () => {
      void markNotificationsRead().then(() => {
        setNotifications(items.map((n) => ({ ...n, read: true })));
        build();
        renderNotifBadge();
      });
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.hidden) { build(); position(); panel.hidden = false; }
    else close();
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && e.target !== btn) close();
  });
  window.addEventListener('resize', () => { if (!panel.hidden) position(); });
}

let tickerPollTimer: number | undefined;
function startActivityPolling(): void {
  if (tickerPollTimer != null) return;
  tickerPollTimer = window.setInterval(() => {
    void fetchActivityFeed(20).then((raw) => {
      applyActivityRaw(raw);
      renderActivityTicker();
    });
  }, 45_000);
}

async function refreshSidebarRank(): Promise<void> {
  const weeklyTour = getLiveTournamentByCadence('weekly');
  if (!weeklyTour) {
    setWeeklyRank(undefined);
    return;
  }
  const me = await playerStandingRemote(weeklyTour.id);
  setWeeklyRank(me?.rank);
  renderSidebar();
}

// Mandatory sign-in gate: the whole portal is subscription/OTP based, so an
// unauthenticated visitor sees a blocking sign-in surface and cannot reach the
// games until they sign in with a phone number + OTP. (Only enforced when an
// auth backend is configured; otherwise the local demo stays open.)
function setupDeferredSections(): void {
  const arm = (id: string, onSeen: () => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!('IntersectionObserver' in window)) { onSeen(); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      onSeen();
    }, { rootMargin: '100px 0px' });
    io.observe(el);
  };
  arm('topPlayers', () => {
    liveBoardSeen = true;
    renderLiveBoard({ fetch: true });
  });
  arm('lbPreview', () => {
    lbPreviewSeen = true;
    renderLbPreview({ fetch: true });
  });
  arm('winners', () => {
    winnersSeen = true;
    renderWinners({ fetch: true });
  });
}

// Nav active-state on scroll (top nav + mobile bottom nav).
const sections = ['games', 'lbPreview', 'topPlayers', 'winners'];
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

// Browse controls (segmented filter + category dropdown + inline search).
let searchPersistTimer: ReturnType<typeof setTimeout> | undefined;

function setupBrowse(): void {
  const gamesSection = document.querySelector('#games');
  gamesSection?.addEventListener('input', (e) => {
    const search = (e.target as HTMLElement).closest<HTMLInputElement>('#gameSearch');
    if (!search) return;
    gameQuery = search.value;
    syncSearchFieldUi(search);
    renderGames();
    if (searchPersistTimer) clearTimeout(searchPersistTimer);
    searchPersistTimer = setTimeout(() => persistBrowseState(), 150);
  });
  gamesSection?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest<HTMLButtonElement>('#gameSeg .pill-tab');
    if (seg) {
      gameFilter = (seg.dataset.filter as typeof gameFilter) ?? 'tournament';
      if (gameFilter === 'tournament') categoryFilter = 'all';
      renderGamesToolbar();
      renderGames();
      persistBrowseState();
      return;
    }
    const ddBtn = (e.target as HTMLElement).closest('#catDropdownBtn');
    if (ddBtn && gameFilter === 'free') {
      const menu = document.querySelector('#catDropdownMenu');
      if (!menu) return;
      const opening = menu.hasAttribute('hidden');
      menu.toggleAttribute('hidden', !opening);
      return;
    }
    const catItem = (e.target as HTMLElement).closest<HTMLButtonElement>('.cat-dd-item');
    if (catItem) {
      categoryFilter = (catItem.dataset.cat as GameCategory | 'all') ?? 'all';
      document.querySelector('#catDropdownMenu')?.setAttribute('hidden', '');
      renderGamesToolbar();
      renderGames();
      applyTranslations();
      persistBrowseState();
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#catDropdown')) {
      document.querySelector('#catDropdownMenu')?.setAttribute('hidden', '');
    }
  });
  document.querySelector('#bnAccount')?.addEventListener('click', () => void openAccount());
  document.querySelector('#footerFaq')?.addEventListener('click', (e) => e.preventDefault());
  document.querySelector('#footerTerms')?.addEventListener('click', (e) => e.preventDefault());
  // Delegated ℹ️ "how to play" — intercept before the card link navigates.
  const howToHost = (e: Event): void => {
    const csInfo = (e.target as HTMLElement).closest<HTMLElement>('[data-howto-cs]');
    if (csInfo) {
      e.preventDefault();
      e.stopPropagation();
      openComingSoonHowTo(csInfo.dataset.howtoCs!);
      return;
    }
    const info = (e.target as HTMLElement).closest<HTMLElement>('.gc-info');
    if (info) {
      e.preventDefault();
      e.stopPropagation();
      const g = getGame(info.dataset.howto!);
      if (g) openHowTo(g);
    }
  };
  document.querySelector('#gameGrid')?.addEventListener('click', howToHost);
  document.querySelector('#trendingShelf')?.addEventListener('click', howToHost);
  document.querySelector('#recentShelf')?.addEventListener('click', howToHost);
  document.querySelector('#comingSoonShelf')?.addEventListener('click', howToHost);
  document.querySelector('#continueShelf')?.addEventListener('click', howToHost);
}

function setupBrowsePersistence(): void {
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = undefined;
      persistBrowseState();
    }, 100);
  }, { passive: true });

  document.addEventListener('click', (e) => {
    const info = (e.target as HTMLElement).closest('.gc-info');
    if (info) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-game-id]');
    if (!card?.dataset.gameId) return;
    const link = card.closest('a[href]') ?? (card.matches('a[href]') ? card : null);
    if (!link) return;
    persistBrowseState({ focusedGameId: card.dataset.gameId });
  }, true);

  window.addEventListener('beforeunload', () => persistBrowseState());
  wireHScrollPersistence();
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
paintSkeletons();
renderAll({ skipGames: true });
requestAnimationFrame(() => renderGames());
scheduleBrowseViewportRestore();
// Keep the top balances strip live as coins/points/gold change.
onWalletChange(() => { renderMyStats(); renderSidebar(); });
onCurrencyChange(() => { renderMyStats(); renderSidebar(); });
setupBrowse();
setupBrowsePersistence();
setupLiveBoardTabs();
setupWinnersTabs();
setupDeferredSections();
syncNavActive();
mountSettings();
mountNotifications();
mountSignInGate();

// Hydrate the points balance from the server (the authority); refresh on load
// and whenever auth changes, then re-render the top balance strip.
let dailyClaimed = false; // once per page load (the server is idempotent per day)
function hydratePointsAfterBootstrap(boot: HubBootstrapResult): void {
  if (!boot.ok || !boot.hadUser) {
    void fetchWallets().then((w) => {
      if (w) { setBalance('xp', w.xp); setLifetime(w.lifetime); }
      if (w && !dailyClaimed) {
        dailyClaimed = true;
        void claimDailyLogin().then((d) => {
          if (d && d.award > 0) { setBalance('xp', d.xp); setLifetime(d.lifetime); }
        });
      }
    });
  } else if (!dailyClaimed) {
    dailyClaimed = true;
    void claimDailyLogin().then((d) => {
      if (d && d.award > 0) { setBalance('xp', d.xp); setLifetime(d.lifetime); }
    });
  }
  void fetchGameStats().then((stats) => {
    gamePlayCounts = stats;
    renderGames();
    renderTrending();
    renderRecentlyAdded();
  });
  void refreshSidebarRank();
  renderActivityTicker();
  renderNotifBadge();
  renderContinuePlaying();
  startActivityPolling();
  if (winnersSeen) renderWinners({ fetch: true });
  if (lbPreviewSeen) renderLbPreview({ fetch: true });
  renderGames();
  scheduleBrowseViewportRestore();
}

async function runBackendHydration(): Promise<void> {
  try {
    await mountWallet({ skipHydrate: true });
    const boot = await bootstrapHubData();
    if (!boot.ok) {
      await loadConfig();
      await balance();
      await Promise.all([loadTournaments(), loadMyEntries()]);
    }
    await refreshPlayerRp();
    hubHydrating = false;
    wireEntryCtas();
    renderGames();
    renderFeaturedTournaments();
    renderContinuePlaying();
    renderLiveBoard({ fetch: liveBoardSeen });
    hydratePointsAfterBootstrap(boot);
  } finally {
    hubHydrating = false;
  }
}

/** Paint the hub first, then load the Supabase SDK chunk and hydrate server data. */
function startBackendHydration(): void {
  if (!isConfigured()) {
    hubHydrating = false;
    void runBackendHydration();
    return;
  }
  requestAnimationFrame(() => {
    void getSupabase().then(() => runBackendHydration());
  });
}

startBackendHydration();
// Re-pull wallet/entries/standing when the player signs in or out.
onAuthChange(() => {
  void (async () => {
    const boot = await bootstrapHubData();
    if (!boot.ok) {
      await refreshData();
      await balance();
    } else {
      wireEntryCtas();
      renderGames();
      renderContinuePlaying();
      renderLiveBoard({ fetch: liveBoardSeen });
    }
    await refreshPlayerRp();
    hydratePointsAfterBootstrap(boot);
  })();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isConfigured()) {
    void refreshPlayerRp();
    void refreshPortalRemote().then((ok) => {
      if (!ok) return;
      renderContinuePlaying();
      renderSidebar();
      renderActivityTicker();
      renderMyStats();
    });
  }
});
setInterval(tickCountdowns, 1000);
setupPromo();
restartPromoTimer();
