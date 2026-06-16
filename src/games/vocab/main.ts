// Vocabulary Strength — ten definitions, rising difficulty. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, shuffled, mountLQ } from '../_lq/lq';
import { mcqQuiz } from '../_lq/mcq';
import { VOCAB, type VocabItem } from '../_lq/data';

const RANKS: Array<[number, string]> = [
  [0, 'Word Watcher'], [4, 'Phrase Finder'], [6, 'Lexicon Climber'],
  [8, 'Vocabulary Heavyweight'], [10, 'Word Wizard'],
];
function rankFor(score: number): string {
  let r = RANKS[0][1];
  for (const [min, name] of RANKS) if (score >= min) r = name;
  return r;
}

mountLQ('vocab', mcqQuiz<VocabItem>({
  gameId: 'vocab',
  rounds: 10,
  help: `<b>Goal:</b> answer all 10 “what does this word mean?” questions.<br><br>
    1. Read the word — the stars show its difficulty (★ easy → ★★★★★ expert).<br>
    2. Tap the definition you believe is correct.<br>
    3. A wrong pick reveals the true meaning.<br><br>
    Get 7+ right to win; a perfect 10 makes you a <b>Word Wizard</b>.`,
  bank() {
    const out: VocabItem[] = [];
    for (let d = 1; d <= 5; d++) out.push(...shuffled(VOCAB.filter((x) => x.d === d)).slice(0, 2));
    return out;
  },
  renderPrompt(item) {
    return el('div', null,
      el('p', { class: 'prompt', text: `What does “${item.q}” mean?` }),
      el('p', { class: 'sub', text: 'Difficulty ' + '★'.repeat(item.d) + '☆'.repeat(5 - item.d) }));
  },
  choicesFor(item) {
    return [{ label: item.a, correct: true }].concat(item.wrong.map((w) => ({ label: w, correct: false })));
  },
  feedback(item, ok) { return ok ? 'Correct!' : `“${item.q}” means: ${item.a}.`; },
  resultTitle(score) { return `💪 ${rankFor(score)}`; },
  resultBody(score, total) {
    const pct = Math.round((score / total) * 100);
    return `You got <b>${score} of ${total}</b> (${pct}%).<br><br>
      <div class="meter"><div class="fill" style="width:${pct}%"></div></div>
      Rank: <b>${rankFor(score)}</b>`;
  },
}));
