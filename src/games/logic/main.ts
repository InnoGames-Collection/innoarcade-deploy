// Logic Riddles — short deduction puzzles. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, shuffled, mountLQ } from '../_lq/lq';
import { mcqQuiz } from '../_lq/mcq';
import { LOGIC, type LogicItem } from '../_lq/data';

mountLQ('logic', mcqQuiz<LogicItem>({
  gameId: 'logic',
  rounds: 10,
  help: `<b>Goal:</b> solve 10 short deduction puzzles.<br><br>
    1. Read the riddle <b>twice</b> — every word matters.<br>
    2. Eliminate answers that contradict the clues.<br>
    3. Tap your answer; each comes with the reasoning explained.<br><br>
    The answer that jumps out first is often the trap. 7+ of 10 wins.`,
  bank() { return shuffled(LOGIC); },
  renderPrompt(item) { return el('p', { class: 'prompt', text: item.q }); },
  choicesFor(item) {
    return [{ label: item.a, correct: true }].concat(item.wrong.map((w) => ({ label: w, correct: false })));
  },
  feedback(item, ok) { return (ok ? 'Correct! ' : '') + item.why; },
  resultTitle(score, total) {
    if (score === total) return '🕵️ Master detective!';
    if (score >= total * 0.7) return '🧩 Solid deduction!';
    return '🪤 The traps got you!';
  },
}));
