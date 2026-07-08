// Hub portal runtime state — recent games, challenge, activity feed, notifications.

export interface RecentGameRow {
  gameId: string;
  lastScore: number;
  lastPlayedAt: string;
  playCount: number;
}

export interface ProgressItem {
  id: string;
  current: number;
  target: number;
  done: boolean;
  reward?: number;
  claimed?: boolean;
}

export interface ChallengeProgress {
  rewardCoins: number;
  claimed: boolean;
  allDone: boolean;
  tasks: ProgressItem[];
  missions: ProgressItem[];
}

export interface ActivityItem {
  id: number;
  player: string;
  game: string;
  event: string;
  score: number;
  win: boolean;
  ts: string;
}

export interface HubNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  meta?: Record<string, unknown>;
}

let recentGames: RecentGameRow[] = [];
let challengeProgress: ChallengeProgress | null = null;
let gamesPlayedToday = 0;
let activityFeed: ActivityItem[] = [];
let notifications: HubNotification[] = [];
let weeklyRank: number | undefined;
let onlineCount = 0;
let analyticsTrendingIds: string[] = [];

function parseChallenge(raw: unknown): ChallengeProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tasks = Array.isArray(o.tasks) ? o.tasks as ProgressItem[] : [];
  const missions = Array.isArray(o.missions) ? o.missions as ProgressItem[] : [];
  return {
    rewardCoins: Number(o.rewardCoins ?? 200),
    claimed: Boolean(o.claimed),
    allDone: Boolean(o.allDone),
    tasks,
    missions,
  };
}

function parseActivity(raw: unknown): ActivityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id ?? 0),
      player: String(r.player ?? 'Player'),
      game: String(r.game ?? ''),
      event: String(r.event ?? 'play'),
      score: Number(r.score ?? 0),
      win: Boolean(r.win),
      ts: String(r.ts ?? ''),
    };
  });
}

function parseNotifications(raw: unknown): HubNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id ?? 0),
      kind: String(r.kind ?? ''),
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      read: Boolean(r.read),
      created_at: String(r.created_at ?? ''),
      meta: (r.meta && typeof r.meta === 'object') ? r.meta as Record<string, unknown> : undefined,
    };
  });
}

export function applyPortalBootstrap(data: {
  recentGames?: RecentGameRow[];
  challenge?: unknown;
  activity?: unknown;
  notifications?: unknown;
  onlineCount?: number;
  trendingIds?: unknown;
}): void {
  recentGames = Array.isArray(data.recentGames) ? data.recentGames : recentGames;
  if (data.challenge !== undefined) {
    challengeProgress = parseChallenge(data.challenge);
    const playTask = challengeProgress?.tasks.find((t) => t.id === 'play3');
    gamesPlayedToday = playTask?.current ?? 0;
  }
  if (data.activity != null) activityFeed = parseActivity(data.activity);
  if (data.notifications != null) notifications = parseNotifications(data.notifications);
  if (typeof data.onlineCount === 'number') onlineCount = Math.max(0, data.onlineCount);
  if (data.trendingIds != null) {
    analyticsTrendingIds = Array.isArray(data.trendingIds)
      ? data.trendingIds.map(String).filter(Boolean)
      : [];
  }
}

export function getRecentGames(): RecentGameRow[] {
  return recentGames;
}

export function getChallengeProgress(): ChallengeProgress | null {
  return challengeProgress;
}

export function getGamesPlayedToday(): number {
  return gamesPlayedToday;
}

export function setChallengeProgress(next: ChallengeProgress | null): void {
  challengeProgress = next;
  const playTask = next?.tasks.find((t) => t.id === 'play3');
  gamesPlayedToday = playTask?.current ?? gamesPlayedToday;
}

export function getActivityFeed(): ActivityItem[] {
  return activityFeed;
}

export function setActivityFeed(items: ActivityItem[]): void {
  activityFeed = items;
}

export function applyActivityRaw(raw: unknown): void {
  activityFeed = parseActivity(raw);
}

export function getNotifications(): HubNotification[] {
  return notifications;
}

export function setNotifications(items: HubNotification[]): void {
  notifications = items;
}

export function unreadNotifCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function setWeeklyRank(rank: number | undefined): void {
  weeklyRank = rank;
}

export function getWeeklyRank(): number | undefined {
  return weeklyRank;
}

export function getOnlineCount(): number {
  return onlineCount;
}

export function setOnlineCount(n: number): void {
  onlineCount = Math.max(0, Math.floor(n));
}

export function getAnalyticsTrendingIds(): string[] {
  return analyticsTrendingIds;
}

export function setAnalyticsTrendingIds(ids: string[]): void {
  analyticsTrendingIds = ids;
}
