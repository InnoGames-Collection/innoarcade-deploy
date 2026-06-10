// Per-game high scores in localStorage.

const PREFIX = 'innoarcade.';

export function getHighScore(game: string): number {
  return Number(localStorage.getItem(`${PREFIX}${game}.best`)) || 0;
}

// Returns true when the score is a new record.
export function setHighScore(game: string, score: number): boolean {
  if (score <= getHighScore(game)) return false;
  localStorage.setItem(`${PREFIX}${game}.best`, String(score));
  return true;
}
