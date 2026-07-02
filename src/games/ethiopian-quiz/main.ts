// Ethiopian Quiz — 10-question batch free quiz.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_quiz/style.css';
import { wireFreeQuizShell } from '../../platform/freeQuizShell';
import { QUIZ_BANK } from './bank';

/** Strip internal difficulty/category prefixes from bank text (not shown to players). */
function publicPrompt(question: string): string {
  return question
    .replace(/^(?:Easy|Hard|Medium|Simple)\s+Ethiopian\s+[^:]+:\s*/i, '')
    .trim();
}

wireFreeQuizShell({
  gameId: 'ethiopian-quiz',
  pointsPerCorrect: 20,
  winScore: 100,
  bank: () => QUIZ_BANK.map((q) => ({
    id: String(q.id),
    prompt: publicPrompt(q.question),
    choices: q.opts,
    answer: q.answer,
  })),
});
