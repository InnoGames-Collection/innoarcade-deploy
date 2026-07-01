// Rhyme Time — continuous timed rhyming-pair quiz.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_quiz/style.css';
import { wireFreeQuizShell } from '../../platform/freeQuizShell';
import { rhymeBank } from '../_quiz/adapters';

wireFreeQuizShell({
  gameId: 'rhyme',
  runSeconds: 60,
  pointsPerCorrect: 10,
  bank: rhymeBank,
});
