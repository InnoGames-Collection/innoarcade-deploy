// Spell It — pick the correct spelling among convincing fakes. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, shuffled, mountLQ } from '../_lq/lq';
import { mcqQuiz } from '../_lq/mcq';
import { SPELL, type SpellItem } from '../_lq/data';

mountLQ('spell', mcqQuiz<SpellItem>({
  gameId: 'spell',
  rounds: 10,
  choiceCols: 2,
  help: `<b>Goal:</b> spot the one correct spelling among convincing fakes.<br><br>
    1. Read the definition in quotes.<br>
    2. Exactly <b>one</b> of the four spellings is right — tap it.<br><br>
    Watch for doubled letters, sneaky vowel swaps and silent letters. 7+ of 10 wins.`,
  bank() { return shuffled(SPELL); },
  renderPrompt(item) {
    return el('div', null,
      el('p', { class: 'prompt', text: 'Which spelling is correct?' }),
      el('p', { class: 'sub', text: '“' + item.def + '”' }));
  },
  choicesFor(item) {
    return [{ label: item.a, correct: true }].concat(item.wrong.map((w) => ({ label: w.trim(), correct: false })));
  },
  feedback(item, ok) { return ok ? 'Correct!' : `The correct spelling is “${item.a}”.`; },
  resultTitle(score, total) {
    if (score === total) return '🐝 Spelling Bee Champion!';
    if (score >= total * 0.7) return '📝 Solid speller!';
    return '📖 Time to hit the dictionary!';
  },
}));
