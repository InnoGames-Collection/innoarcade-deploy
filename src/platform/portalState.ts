// Hub portal runtime state — recent games + daily challenge progress from bootstrap.

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
}

export interface ChallengeProgress {
  rewardCoins: number;
  claimed: boolean;
  allDone: boolean;
  tasks: ProgressItem[];
  missions: ProgressItem[];
}

let recentGames: RecentGameRow[] = [];
let challengeProgress: ChallengeProgress | null = null;
let gamesPlayedToday = 0;

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

export function applyPortalBootstrap(data: {
  recentGames?: RecentGameRow[];
  challenge?: unknown;
}): void {
  recentGames = Array.isArray(data.recentGames) ? data.recentGames : [];
  challengeProgress = parseChallenge(data.challenge);
  const playTask = challengeProgress?.tasks.find((t) => t.id === 'play3');
  gamesPlayedToday = playTask?.current ?? 0;
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
