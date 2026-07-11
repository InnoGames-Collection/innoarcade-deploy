// Hub portal sections — trending, tournament banner, sidebar widgets, news, etc.
// Phase 1: catalog-driven + static placeholders; no game code touched.

import { t, type Lang, type I18nKey } from '../i18n';
import {
  trendingGames, recentlyAddedGames, COMING_SOON, CATEGORY_CHIPS,
  activeFreeCategories, type GameMeta, type GameCategory, type ComingSoonMeta, getGame,
} from '../platform/catalog';
import {
  countdown, type Tournament,
} from '../platform/tournaments';
import { etbPrizesForCadence, formatEtbPrize, config, TOURNAMENT_ETB_PRIZES } from '../platform/config';
import { getChallengeProgress, type ChallengeProgress, type ProgressItem, type ActivityItem, type HubNotification, getOnlineCount } from '../platform/portalState';
import { type LeaderEntry } from '../platform/tournaments';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function fmtPlayCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

export function starsHtml(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

const dShort = (lang: Lang): string => (lang === 'am' ? 'ቀ' : 'd');
const hShort = (lang: Lang): string => (lang === 'am' ? 'ሰ' : 'h');
const mShort = (lang: Lang): string => (lang === 'am' ? 'ደ' : 'm');
const sShort = (lang: Lang): string => (lang === 'am' ? 'ሰ' : 's');

export function fmtCountdown(end: number, lang: Lang): string {
  const c = countdown(end);
  if (c.done) return '—';
  if (c.days > 0) return `${c.days}${dShort(lang)} ${c.hours}${hShort(lang)} ${c.minutes}${mShort(lang)}`;
  return `${c.hours}${hShort(lang)} ${c.minutes}${mShort(lang)} ${c.seconds}${sShort(lang)}`;
}

export function fmtLastPlayed(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffMs = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return t('hub.playedJustNow');
  if (mins < 60) return t('hub.playedMinutesAgo').replace('{n}', String(mins));
  if (hours < 24) return t('hub.playedHoursAgo').replace('{n}', String(hours));
  return t('hub.playedDaysAgo').replace('{n}', String(Math.min(days, 99)));
}

export function sectionHead(emoji: string, titleKey: I18nKey, link?: { href: string; labelKey: I18nKey }): string {
  const linkHtml = link
    ? `<a class="section-link" href="${link.href}">${t(link.labelKey)} →</a>`
    : '';
  return `
    <div class="section-head">
      <h2 class="section-title">${emoji} <span data-i18n="${titleKey}">${t(titleKey)}</span></h2>
      ${linkHtml}
    </div>`;
}

export function gamesToolbarHtml(opts: {
  gameFilter: 'tournament' | 'free';
  categoryFilter: GameCategory | 'all';
  langCode: Lang;
  searchQuery?: string;
}): string {
  const cats = activeFreeCategories();
  const catDisabled = opts.gameFilter === 'tournament';
  const allLabel = t('hub.catAll');
  let selectedLabel = allLabel;
  if (opts.categoryFilter !== 'all') {
    const meta = cats.find((c) => c.id === opts.categoryFilter);
    if (meta) selectedLabel = opts.langCode === 'am' ? meta.labelAm : meta.labelEn;
  }
  const menuItems = [
    `<button type="button" class="cat-dd-item${opts.categoryFilter === 'all' ? ' on' : ''}" data-cat="all" role="option">${escapeHtml(allLabel)}</button>`,
    ...cats.map((c) => {
      const label = opts.langCode === 'am' ? c.labelAm : c.labelEn;
      const on = opts.categoryFilter === c.id ? ' on' : '';
      return `<button type="button" class="cat-dd-item${on}" data-cat="${c.id}" role="option"><span class="cat-dd-ico">${c.icon}</span>${escapeHtml(label)}</button>`;
    }),
  ].join('');
  const q = opts.searchQuery ?? '';
  const tourOn = opts.gameFilter === 'tournament';
  const freeOn = opts.gameFilter === 'free';
  return `
    <div class="games-head" id="gamesToolbar">
      <div class="pill-tabs" id="gameSeg" role="tablist" aria-label="Game modes">
        <span class="pill-tabs-indicator" aria-hidden="true"></span>
        <button type="button" class="pill-tab${tourOn ? ' active' : ''}" data-filter="tournament" role="tab"
          aria-selected="${tourOn}" data-i18n="hub.tournament">${t('hub.tournament')}</button>
        <button type="button" class="pill-tab${freeOn ? ' active' : ''}" data-filter="free" role="tab"
          aria-selected="${freeOn}" data-i18n="hub.freeGames">${t('hub.freeGames')}</button>
      </div>
      <div class="cat-dropdown${catDisabled ? ' is-disabled' : ''}" id="catDropdown">
        <button type="button" class="cat-dropdown-btn" id="catDropdownBtn" aria-haspopup="listbox" ${catDisabled ? 'disabled' : ''}>
          <span class="cat-dropdown-lbl" data-i18n="hub.categories">${t('hub.categories')}</span>
          <span class="cat-dropdown-val">${escapeHtml(selectedLabel)}</span>
          <span class="cat-dropdown-chev" aria-hidden="true">▾</span>
        </button>
        <div class="cat-dropdown-menu" id="catDropdownMenu" role="listbox" hidden>${menuItems}</div>
      </div>
      <div class="search-field search-field--toolbar${q ? ' has-value' : ''}" id="gameSearchWrap">
        <svg class="search-field-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="gameSearch" class="search-field-input" type="search" value="${escapeHtml(q)}"
          data-i18n-placeholder="hub.searchGamesPremium" placeholder="${t('hub.searchGamesPremium')}"
          aria-label="${t('hub.searchGames')}" autocomplete="off" enterkeyhint="search" />
        <button type="button" class="search-field-clear" id="gameSearchClear"
          aria-label="${t('hub.searchClear')}"${q ? '' : ' hidden'}>×</button>
      </div>
    </div>`;
}

/** @deprecated chips replaced by gamesToolbarHtml dropdown */
export function categoryChipsHtml(active: GameCategory | 'all', lang: Lang): string {
  return CATEGORY_CHIPS.map((c) => {
    const label = lang === 'am' ? c.labelAm : c.labelEn;
    const on = c.id === active ? ' on' : '';
    return `<button type="button" class="cat-chip${on}" data-cat="${c.id}"><span class="cat-chip-ico">${c.icon}</span><span>${escapeHtml(label)}</span></button>`;
  }).join('');
}

export function quickActionsHtml(): string {
  const items: { href?: string; icon: string; key: I18nKey; isBtn?: boolean }[] = [
    { href: '#featuredTournaments', icon: '🏆', key: 'hub.quickTournaments' },
    { href: '#lbPreview', icon: '🥇', key: 'hub.quickLeaderboard' },
    { href: '#dailyChallenge', icon: '🎯', key: 'hub.quickMissions' },
    { href: '#games', icon: '🎮', key: 'hub.quickGames' },
    { icon: '👤', key: 'hub.quickAccount', isBtn: true },
  ];
  return items.map((item) => {
    if (item.isBtn) {
      return `<button type="button" class="qa-btn" data-qa-account><span class="qa-ico">${item.icon}</span><span data-i18n="${item.key}">${t(item.key)}</span></button>`;
    }
    return `<a class="qa-btn" href="${item.href}"><span class="qa-ico">${item.icon}</span><span data-i18n="${item.key}">${t(item.key)}</span></a>`;
  }).join('');
}

export interface WeeklyBannerOpts {
  lang: Lang;
  gameName: string;
  gameIcon: string;
  gameRoute: string;
  tour: Tournament;
  title: string;
}

export interface FeaturedBannerOpts {
  cadence: 'weekly' | 'monthly';
  lang: Lang;
  gameName: string;
  gameIcon: string;
  gameRoute: string;
  gameId: string;
  tour: Tournament;
  title: string;
}

export function featuredTournamentBannerHtml(opts: FeaturedBannerOpts): string {
  const prizes = TOURNAMENT_ETB_PRIZES[opts.gameId] ?? etbPrizesForCadence(opts.cadence);
  const top = prizes[0] ?? 0;
  const pool = prizes.reduce((s, p) => s + p, 0);
  const online = getOnlineCount();
  const onlineLabel = online > 0
    ? t('hub.onlinePlayers').replace('{n}', fmtPlayCount(online))
    : t('hub.onlinePlayers').replace('{n}', '0');
  const eyebrowKey = opts.cadence === 'weekly' ? 'hub.weeklyChampionship' : 'hub.monthlyChampionship';
  const bannerClass = opts.cadence === 'weekly' ? 'weekly-banner' : 'weekly-banner monthly-banner';
  return `
    <article class="${bannerClass} featured-tournament-card">
      <div class="wb-glow" aria-hidden="true">${opts.gameIcon}</div>
      <div class="wb-body">
        <span class="wb-eyebrow" data-i18n="${eyebrowKey}">${t(eyebrowKey)}</span>
        <h2 class="wb-title">${escapeHtml(opts.title)}</h2>
        <p class="wb-game">${escapeHtml(opts.gameName)}</p>
        <div class="wb-meta">
          <div class="wb-stat wb-stat--hero">
            <span class="wb-stat-lbl" data-i18n="hub.topPrize">${t('hub.topPrize')}</span>
            <strong class="wb-stat-val">${escapeHtml(formatEtbPrize(top, opts.lang))}</strong>
          </div>
          <div class="wb-stat">
            <span class="wb-stat-lbl" data-i18n="hub.totalPrizesTop5">${t('hub.totalPrizesTop5')}</span>
            <strong class="wb-stat-val wb-stat-val--sub">${escapeHtml(formatEtbPrize(pool, opts.lang))}</strong>
          </div>
          <div class="wb-stat">
            <span class="wb-stat-lbl" data-i18n="hub.endsIn">${t('hub.endsIn')}</span>
            <strong class="wb-stat-val wb-stat-val--sub wb-countdown" data-ends="${opts.tour.endsAt}">${fmtCountdown(opts.tour.endsAt, opts.lang)}</strong>
          </div>
          <div class="wb-stat">
            <span class="wb-stat-lbl" data-i18n="hub.playersOnline">${t('hub.playersOnline')}</span>
            <strong class="wb-stat-val wb-stat-val--sub wb-online-count">${escapeHtml(onlineLabel)}</strong>
          </div>
        </div>
        <a class="btn primary wb-cta" href="${opts.gameRoute}" data-i18n="hub.joinNow">${t('hub.joinNow')}</a>
      </div>
    </article>`;
}

export function featuredTournamentsHtml(cards: string[]): string {
  return `<div class="featured-tournaments-grid">${cards.join('')}</div>`;
}

/** @deprecated use featuredTournamentBannerHtml */
export function weeklyTournamentBannerHtml(opts: WeeklyBannerOpts): string {
  return featuredTournamentBannerHtml({
    cadence: 'weekly',
    lang: opts.lang,
    gameName: opts.gameName,
    gameIcon: opts.gameIcon,
    gameRoute: opts.gameRoute,
    gameId: opts.tour.gameId,
    tour: opts.tour,
    title: opts.title,
  });
}

const TASK_LABELS: Record<string, I18nKey> = {
  score: 'hub.challengeScore',
  play3: 'hub.challengePlay3',
  memory: 'hub.challengeMemory',
};
const MISSION_LABELS: Record<string, I18nKey> = {
  play5: 'hub.missionPlay5',
  win2: 'hub.missionWin2',
  tournament: 'hub.missionTournament',
};

function taskLabel(id: string): string {
  const key = TASK_LABELS[id];
  return key ? t(key) : id;
}

function missionLabel(id: string): string {
  const key = MISSION_LABELS[id];
  return key ? t(key) : id;
}

export function dailyChallengeHtml(progress?: ChallengeProgress | null): string {
  const p = progress ?? getChallengeProgress();
  const reward = p?.rewardCoins ?? config().portal?.dailyChallenge?.rewardCoins ?? 200;
  const tasks = p?.tasks?.length ? p.tasks : [
    { id: 'score', current: 0, target: 5000, done: false },
    { id: 'play3', current: 0, target: 3, done: false },
    { id: 'memory', current: 0, target: 1, done: false },
  ];
  const rows = tasks.map((task) =>
    `<li class="dc-task${task.done ? ' done' : ''}"><span class="dc-check">${task.done ? '✔' : '○'}</span><span>${escapeHtml(taskLabel(task.id))}</span></li>`,
  ).join('');
  const allDone = p?.allDone ?? false;
  const claimed = p?.claimed ?? false;
  let cta = `<a class="btn primary dc-cta" href="#games" data-i18n="hub.playNow">${t('hub.playNow')}</a>`;
  if (allDone && !claimed) {
    cta = `<button type="button" class="btn primary dc-cta" id="claimChallengeBtn" data-i18n="hub.claimReward">${t('hub.claimReward')}</button>`;
  } else if (claimed) {
    cta = `<p class="dc-claimed" data-i18n="hub.challengeClaimed">${t('hub.challengeClaimed')}</p>`;
  }
  return `
    <article class="widget-card challenge-card" id="dailyChallenge">
      <h3 class="widget-title">🎯 <span data-i18n="hub.dailyChallenge">${t('hub.dailyChallenge')}</span></h3>
      <ul class="dc-tasks">${rows}</ul>
      <div class="dc-reward">
        <span data-i18n="hub.reward">${t('hub.reward')}</span>
        <strong>+${reward} <span data-i18n="hub.coinsLabel">${t('hub.coinsLabel')}</span></strong>
      </div>
      ${cta}
    </article>`;
}

export interface SidebarDashOpts {
  level: number;
  xpPct: number;
  xp: number;
  nextXp: number;
  coins: number;
  gamesPlayed: number;
  rank?: number;
}

export function sidebarDashboardHtml(opts: SidebarDashOpts): string {
  const rankStr = opts.rank != null && opts.rank > 0 ? `#${opts.rank}` : '—';
  return `
    <article class="widget-card dash-card">
      <h3 class="widget-title">📊 <span data-i18n="hub.myDashboard">${t('hub.myDashboard')}</span></h3>
      <div class="dash-level">
        <span data-i18n="hub.statLevel">${t('hub.statLevel')}</span>
        <strong>${opts.level}</strong>
      </div>
      <div class="dash-bar" role="progressbar" aria-valuenow="${opts.xpPct}" aria-valuemin="0" aria-valuemax="100">
        <div class="dash-bar-fill" style="width:${opts.xpPct}%"></div>
      </div>
      <div class="dash-grid">
        <div class="dash-stat"><span class="dash-lbl" data-i18n="hub.dashScore">${t('hub.dashScore')}</span><strong>${opts.xp.toLocaleString()}</strong></div>
        <div class="dash-stat"><span class="dash-lbl" data-i18n="hub.dashGames">${t('hub.dashGames')}</span><strong>${opts.gamesPlayed}</strong></div>
        <div class="dash-stat"><span class="dash-lbl" data-i18n="hub.dashRank">${t('hub.dashRank')}</span><strong>${rankStr}</strong></div>
        <div class="dash-stat"><span class="dash-lbl" data-i18n="hub.coinsLabel">${t('hub.coinsLabel')}</span><strong>${opts.coins.toLocaleString()}</strong></div>
      </div>
    </article>`;
}

export function dailyMissionsHtml(progress?: ChallengeProgress | null): string {
  const p = progress ?? getChallengeProgress();
  const missions: ProgressItem[] = p?.missions?.length ? p.missions : [
    { id: 'play5', current: 0, target: 5, done: false, reward: 50 },
    { id: 'win2', current: 0, target: 2, done: false, reward: 80 },
    { id: 'tournament', current: 0, target: 1, done: false, reward: 100 },
  ];
  const rows = missions.map((m) => {
    const pct = m.target > 0 ? Math.min(100, Math.round((m.current / m.target) * 100)) : 0;
    const reward = m.reward ?? 0;
    const doneCls = m.done ? ' mission-row--done' : '';
    const claimedCls = m.claimed ? ' mission-row--claimed' : '';
    const rewardLbl = m.claimed
      ? `<span class="mission-claimed">✔ ${t('hub.missionClaimed')}</span>`
      : `<span class="mission-reward">+${reward} 🪙</span>`;
    return `
      <div class="mission-row${doneCls}${claimedCls}">
        <div class="mission-top">
          <span>${escapeHtml(missionLabel(m.id))}</span>
          ${rewardLbl}
        </div>
        <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
        <span class="mission-prog">${m.current}/${m.target}</span>
      </div>`;
  }).join('');
  return `
    <article class="widget-card missions-card">
      <h3 class="widget-title">📋 <span data-i18n="hub.dailyMissions">${t('hub.dailyMissions')}</span></h3>
      ${rows}
      <p class="widget-note" data-i18n="hub.missionsNote">${t('hub.missionsNote')}</p>
    </article>`;
}

export function nextRewardHtml(level: number, xpToNext: number, xpPct: number): string {
  const pct = Math.min(100, Math.max(0, xpPct));
  return `
    <article class="widget-card reward-next-card">
      <h3 class="widget-title">🎁 <span data-i18n="hub.nextReward">${t('hub.nextReward')}</span></h3>
      <div class="reward-chest" aria-hidden="true">🧰</div>
      <p class="reward-next-txt">${t('hub.nextRewardSub').replace('{n}', String(xpToNext.toLocaleString()))}</p>
      <div class="mission-bar"><div class="mission-bar-fill mission-bar-fill--gold" style="width:${pct}%"></div></div>
      <p class="reward-level-hint">${t('hub.statLevel')} ${level} → ${level + 1}</p>
    </article>`;
}

function gameDisplayName(gameId: string, langCode: Lang): string {
  const g = getGame(gameId);
  if (!g) return gameId;
  return langCode === 'am' ? g.nameAm : g.nameEn;
}

function formatActivityLine(item: ActivityItem, langCode: Lang): string {
  const gname = escapeHtml(gameDisplayName(item.game, langCode));
  const player = escapeHtml(item.player);
  if (item.event === 'tournament_play') {
    return `<span class="ticker-item">🏆 ${player} ${t('hub.activityTournament')} ${gname}</span>`;
  }
  if (item.score >= 1000) {
    return `<span class="ticker-item">⭐ ${player} ${t('hub.activityScored')} ${item.score.toLocaleString()} ${t('hub.activityIn')} ${gname}</span>`;
  }
  return `<span class="ticker-item">🎮 ${player} ${t('hub.activityPlaying')} ${gname}</span>`;
}

/** Marquee strip — admin ticker templates + recent anonymized plays. */
export function activityTickerHtml(
  items: ActivityItem[],
  langCode: Lang,
  onlineCount = 0,
): string {
  const templates = config().portal?.tickerMessages ?? [];
  const promoChunks = templates.map((m) => {
    const raw = langCode === 'am' ? m.am : m.en;
    const text = raw.replace(/\{online\}/g, onlineCount.toLocaleString());
    return `<span class="ticker-item ticker-item--promo">${escapeHtml(text)}</span>`;
  });
  const playChunks = items.map((item) => formatActivityLine(item, langCode));
  const chunks = [...promoChunks, ...playChunks];
  if (!chunks.length) {
    const fallback = t('hub.onlinePlayers').replace('{n}', onlineCount.toLocaleString());
    chunks.push(`<span class="ticker-item ticker-item--promo">${escapeHtml(fallback)}</span>`);
  }
  const track = [...chunks, ...chunks].join('<span class="ticker-sep">•</span>');
  return `
    <div class="activity-ticker" aria-live="polite">
      <span class="activity-ticker-label" data-i18n="hub.liveActivity">${t('hub.liveActivity')}</span>
      <div class="activity-ticker-viewport">
        <div class="activity-ticker-track">${track}</div>
      </div>
    </div>`;
}

/** Placeholder cards while shelves hydrate. */
export function shelfSkeletonHtml(count = 4): string {
  return `<div class="hscroll-track">${Array.from({ length: count }, () =>
    `<div class="hscroll-item"><div class="skel-poster skel-poster--compact" aria-hidden="true">
      <div class="skel-poster-thumb"></div>
      <div class="skel-poster-body"><div class="skel-line skel-line--title"></div><div class="skel-line skel-line--btn"></div></div>
    </div></div>`,
  ).join('')}</div>`;
}

export function gridSkeletonHtml(count = 8): string {
  const cards = Array.from({ length: count }, () =>
    `<div class="skel-poster" aria-hidden="true">
      <div class="skel-poster-thumb"></div>
      <div class="skel-poster-body">
        <div class="skel-line skel-line--title"></div>
        <div class="skel-line skel-line--sub"></div>
        <div class="skel-line skel-line--meta"></div>
        <div class="skel-line skel-line--btn"></div>
      </div>
    </div>`,
  ).join('');
  return `<div class="cat-shelf skel-grid">${cards}</div>`;
}

export function cpSkeletonHtml(count = 2): string {
  const cards = Array.from({ length: count }, () =>
    `<article class="cp-card cp-card--skel" aria-hidden="true">
      <div class="skel-thumb-block"></div>
      <div class="cp-body">
        <div class="skel-line skel-line--title"></div>
        <div class="skel-line skel-line--bar"></div>
        <div class="skel-line skel-line--btn"></div>
      </div>
    </article>`,
  ).join('');
  return `<div class="cp-list cp-skel-list">${cards}</div>`;
}

export function bannerSkeletonHtml(count = 2): string {
  const banners = Array.from({ length: count }, () =>
    `<div class="skel-banner" aria-hidden="true"></div>`,
  ).join('');
  return `<div class="featured-tournaments-grid skel-banner-grid">${banners}</div>`;
}

export function lbSkeletonHtml(count = 3): string {
  return Array.from({ length: count }, () => `<div class="skel-row" aria-hidden="true"></div>`).join('');
}

export function notificationsPanelHtml(items: HubNotification[]): string {
  if (!items.length) {
    return `<p class="notif-empty" data-i18n="hub.notifEmpty">${t('hub.notifEmpty')}</p>`;
  }
  const rows = items.map((n) => `
    <button type="button" class="notif-row${n.read ? '' : ' unread'}" data-notif-id="${n.id}">
      <span class="notif-kind">${notifIcon(n.kind)}</span>
      <span class="notif-body">
        <strong>${escapeHtml(n.title)}</strong>
        <span>${escapeHtml(n.body)}</span>
      </span>
    </button>`).join('');
  return `<div class="notif-list">${rows}</div>`;
}

function notifIcon(kind: string): string {
  if (kind === 'mission') return '🪙';
  if (kind === 'challenge_ready') return '🎯';
  return '🔔';
}

function newsItems(lang: Lang) {
  const fromConfig = config().portal?.news;
  if (fromConfig?.length) {
    return fromConfig.map((n) => ({
      icon: n.icon,
      text: lang === 'am' ? n.textAm : n.textEn,
      ago: n.ago,
    }));
  }
  return [
    { icon: '🏆', text: t('hub.newsTournament'), ago: '2h' },
    { icon: '🎮', text: t('hub.newsGames'), ago: '1d' },
    { icon: '⭐', text: t('hub.newsDouble'), ago: '2d' },
    { icon: '🔧', text: t('hub.newsMaintenance'), ago: '3d' },
  ];
}

export function newsFeedHtml(langCode: Lang): string {
  const rows = newsItems(langCode).map((n) => `
    <li class="news-item">
      <span class="news-ico">${n.icon}</span>
      <div class="news-body">
        <span>${escapeHtml(n.text)}</span>
        <time class="news-ago">${n.ago}</time>
      </div>
    </li>`).join('');
  return `
    <section class="portal-section news-section" id="news">
      ${sectionHead('📰', 'hub.newsEvents')}
      <ul class="news-list">${rows}</ul>
    </section>`;
}

export function sidebarNewsHtml(langCode: Lang): string {
  const rows = newsItems(langCode).slice(0, 3).map((n) => `
    <li class="news-item news-item--compact">
      <span class="news-ico">${n.icon}</span>
      <span>${escapeHtml(n.text)}</span>
    </li>`).join('');
  return `
    <article class="widget-card news-widget">
      <h3 class="widget-title">📰 <span data-i18n="hub.newsEvents">${t('hub.newsEvents')}</span></h3>
      <ul class="news-list news-list--compact">${rows}</ul>
      <a class="section-link" href="#news" data-i18n="hub.viewAll">${t('hub.viewAll')} →</a>
    </article>`;
}

export function rewardsTiersHtml(lang: Lang): string {
  const weekly = etbPrizesForCadence('weekly');
  const tiles = weekly.slice(0, 3).map((p) =>
    `<div class="reward-tier"><span class="reward-tier-val">${formatEtbPrize(p, lang)}</span><span class="reward-tier-lbl" data-i18n="hub.prize">${t('hub.prize')}</span></div>`,
  ).join('');
  return `<div class="reward-tiers">${tiles}</div>`;
}

export function lbPreviewRow(r: LeaderEntry): string {
  const medal = ['🥇', '🥈', '🥉'];
  const rp = r.rp ?? r.score;
  const rpStr = typeof rp === 'number' ? (rp % 1 === 0 ? String(rp) : rp.toFixed(1)) : String(rp);
  return `
    <div class="lb-preview-row${r.rank <= 3 ? ' top' : ''}${r.isPlayer ? ' me' : ''}">
      <span class="lb-preview-rank">${medal[r.rank - 1] ?? r.rank}</span>
      <span class="lb-preview-name">${escapeHtml(r.isPlayer ? t('td.you') : r.name)}</span>
      <span class="lb-preview-score">${rpStr} RP</span>
    </div>`;
}

export function comingSoonCard(teaser: ComingSoonMeta, lang: Lang): string {
  const name = lang === 'am' ? teaser.nameAm : teaser.nameEn;
  const eta = lang === 'am' ? (teaser.etaAm ?? teaser.etaEn) : teaser.etaEn;
  const cover = teaser.cover;
  const thumbStyle = cover
    ? ''
    : ` style="background:linear-gradient(145deg,${teaser.thumb[0]},${teaser.thumb[1]})"`;
  return `
    <article class="cs-card">
      <div class="cs-thumb${cover ? ' cs-thumb-cover' : ''}"${thumbStyle}>
        ${cover
          ? `<img class="cs-cover" src="${cover}" alt="" loading="lazy" />`
          : `<span class="cs-glyph">${teaser.icon}</span>`}
        <span class="cs-badge" data-i18n="hub.soon">${t('hub.soon')}</span>
        <button type="button" class="gc-info cs-info" data-howto-cs="${teaser.id}" aria-label="${t('hub.howToPlay')}">?</button>
      </div>
      <h4 class="cs-title">${escapeHtml(name)}</h4>
      ${eta ? `<p class="cs-eta">${escapeHtml(eta)}</p>` : ''}
    </article>`;
}

export function hScrollShelf(games: GameMeta[], cardHtml: (g: GameMeta) => string): string {
  if (!games.length) return `<p class="cat-empty">${t('hub.noResults')}</p>`;
  return `<div class="hscroll-track">${games.map((g) => `<div class="hscroll-item">${cardHtml(g)}</div>`).join('')}</div>`;
}

export function continuePlayingHtml(
  langCode: Lang,
  rows: { game: GameMeta; lastScore: number; progressPct: number; lastPlayedAt: string }[],
): string {
  if (!rows.length) return '';
  const cards = rows.map(({ game, progressPct, lastPlayedAt }) => {
    const gname = langCode === 'am' ? game.nameAm : game.nameEn;
    const lastLabel = fmtLastPlayed(lastPlayedAt);
    const lastHtml = lastLabel
      ? `<time class="cp-last" datetime="${escapeHtml(lastPlayedAt)}">${escapeHtml(lastLabel)}</time>`
      : '';
    return `
      <article class="cp-card">
        <div class="cp-thumb" aria-hidden="true">${game.icon}</div>
        <div class="cp-body">
          <div class="cp-head">
            <h4 class="cp-title">${escapeHtml(gname)}</h4>
            ${lastHtml}
          </div>
          <div class="cp-progress">
            <div class="cp-progress-meta">
              <span class="cp-progress-lbl" data-i18n="hub.progress">${t('hub.progress')}</span>
              <span class="cp-pct">${progressPct}%</span>
            </div>
            <div class="cp-progress-track" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100">
              <div class="cp-progress-fill" data-pct="${progressPct}" style="width:0%"></div>
            </div>
          </div>
          <a class="btn primary cp-btn" href="${game.route}" data-game-id="${game.id}">
            <span data-i18n="hub.resume">${t('hub.resume')}</span>
            <span class="cp-btn-arrow" aria-hidden="true">▶</span>
          </a>
        </div>
      </article>`;
  }).join('');
  return `<div class="cp-list">${cards}</div>`;
}

export function comingSoonShelfHtml(langCode: Lang): string {
  return `<div class="hscroll-track cs-track">${COMING_SOON.map((teaser) => `<div class="hscroll-item hscroll-item--cs">${comingSoonCard(teaser, langCode)}</div>`).join('')}</div>`;
}

/** IDs for trending/recent helpers (re-export for tests). */
export { trendingGames, recentlyAddedGames };
