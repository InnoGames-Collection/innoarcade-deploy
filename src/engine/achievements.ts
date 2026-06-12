// Achievements + daily challenge/streak. Definitions are registered per game;
// progress and unlock state live in a versioned localStorage record. Unlocking
// an achievement fires a toast callback so the UI can celebrate it.

const KEY = 'innoarcade.achievements.v1';

export interface AchievementDef {
  id: string;
  game: string;
  titleEn: string;
  titleAm: string;
  descEn: string;
  descAm: string;
  goal: number; // progress target
  reward: number; // coins granted on unlock
  icon: string; // emoji or sprite id
}

interface AchState {
  version: 1;
  progress: Record<string, number>; // id -> current progress
  unlocked: string[];
  daily: { date: string; streak: number; claimed: boolean };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

class Achievements {
  private defs = new Map<string, AchievementDef>();
  private state: AchState;
  onUnlock: (def: AchievementDef) => void = () => {};

  constructor() {
    this.state = this.read();
    this.rolloverDaily();
  }

  private read(): AchState {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as AchState;
    } catch { /* fall through */ }
    return { version: 1, progress: {}, unlocked: [], daily: { date: '', streak: 0, claimed: false } };
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }

  register(defs: AchievementDef[]): void {
    for (const d of defs) this.defs.set(d.id, d);
  }

  // Advance an achievement's progress; unlocks (and rewards) when the goal is met.
  progress(id: string, amount = 1): void {
    if (this.state.unlocked.includes(id)) return;
    const def = this.defs.get(id);
    if (!def) return;
    const next = (this.state.progress[id] ?? 0) + amount;
    this.state.progress[id] = next;
    if (next >= def.goal) {
      this.state.unlocked.push(id);
      this.save();
      this.onUnlock(def);
    } else {
      this.save();
    }
  }

  // Set progress to an absolute value (e.g. a high score milestone).
  setProgress(id: string, value: number): void {
    if ((this.state.progress[id] ?? 0) >= value) return;
    this.state.progress[id] = 0;
    this.progress(id, value);
  }

  isUnlocked(id: string): boolean {
    return this.state.unlocked.includes(id);
  }

  list(game?: string): Array<AchievementDef & { current: number; done: boolean }> {
    return [...this.defs.values()]
      .filter((d) => !game || d.game === game)
      .map((d) => ({
        ...d,
        current: Math.min(this.state.progress[d.id] ?? 0, d.goal),
        done: this.state.unlocked.includes(d.id),
      }));
  }

  // --- Daily challenge / streak -------------------------------------------
  private rolloverDaily(): void {
    const t = today();
    if (this.state.daily.date === t) return;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const continued = this.state.daily.date === yesterday;
    this.state.daily = {
      date: t,
      streak: continued ? this.state.daily.streak : 0,
      claimed: false,
    };
    this.save();
  }

  dailyAvailable(): boolean {
    this.rolloverDaily();
    return !this.state.daily.claimed;
  }

  get streak(): number {
    return this.state.daily.streak;
  }

  // Claim today's reward; returns the streak day (1-based) or 0 if already claimed.
  claimDaily(): number {
    this.rolloverDaily();
    if (this.state.daily.claimed) return 0;
    this.state.daily.claimed = true;
    this.state.daily.streak++;
    this.save();
    return this.state.daily.streak;
  }
}

export const achievements = new Achievements();
