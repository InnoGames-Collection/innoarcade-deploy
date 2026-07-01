// Ethiopian Quiz — continuous timed free quiz.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_quiz/style.css';
import { wireFreeQuizShell } from '../../platform/freeQuizShell';
import { QUIZ_BANK } from './bank';

wireFreeQuizShell({
  gameId: 'ethiopian-quiz',
  runSeconds: 60,
  pointsPerCorrect: 20,
  bank: () => QUIZ_BANK.map((q) => ({
    prompt: q.question,
    choices: q.opts,
    answer: q.answer,
  })),
});
