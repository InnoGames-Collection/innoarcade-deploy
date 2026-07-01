// Number Sequence — find the hidden rule, type the next number. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, toast, modal, keypad, finishLQRound, mulberry32, randInt, sound, mountLQ } from '../_lq/lq';

const ROUNDS = 8;

interface Term { terms: number[]; next: number; rule: string; }
function fromFn(f: (i: number) => number, rule: string): Term {
  const terms = [0, 1, 2, 3].map(f);
  return { terms, next: f(4), rule };
}
function lin(a: number, d: number, rule: string): Term { return fromFn((i) => a + i * d, rule); }
function geo(a: number, q: number, rule: string): Term { return fromFn((i) => a * Math.pow(q, i), rule); }
function fib(a: number, b: number, rule: string): Term {
  const t = [a, b];
  while (t.length < 5) t.push(t[t.length - 1] + t[t.length - 2]);
  return { terms: t.slice(0, 4), next: t[4], rule };
}
function alt(a: number, p: number, q: number, rule: string): Term {
  const t = [a];
  for (let i = 0; i < 4; i++) t.push(t[t.length - 1] + (i % 2 === 0 ? p : q));
  return { terms: t.slice(0, 4), next: t[4], rule };
}
function acc(a: number, d: number, rule: string): Term {
  const t = [a]; let step = d;
  for (let i = 0; i < 4; i++) { t.push(t[t.length - 1] + step); step += d; }
  return { terms: t.slice(0, 4), next: t[4], rule };
}

const GENERATORS: Array<{ d: number; make: (r: () => number) => Term }> = [
  { d: 1, make: (r) => { const a = randInt(1, 20, r), d = randInt(2, 9, r); return lin(a, d, 'add ' + d); } },
  { d: 1, make: (r) => { const a = randInt(40, 90, r), d = randInt(2, 9, r); return lin(a, -d, 'subtract ' + d); } },
  { d: 2, make: (r) => { const a = randInt(1, 4, r), q = randInt(2, 3, r); return geo(a, q, 'multiply by ' + q); } },
  { d: 2, make: (r) => { const s = randInt(1, 6, r); return fromFn((i) => (s + i) * (s + i), 'square numbers'); } },
  { d: 3, make: (r) => { const a = randInt(1, 5, r), b = randInt(2, 6, r); return fib(a, b, 'add the previous two terms'); } },
  { d: 3, make: (r) => { const a = randInt(2, 8, r), p = randInt(2, 5, r), q = randInt(6, 9, r); return alt(a, p, q, `alternate +${p}, +${q}`); } },
  { d: 4, make: (r) => { const s = randInt(1, 4, r); return fromFn((i) => (s + i) ** 3, 'cube numbers'); } },
  { d: 4, make: (r) => { const a = randInt(2, 6, r), d = randInt(1, 4, r); return acc(a, d, 'the amount added grows by ' + d + ' each step'); } },
];

function render(mount: HTMLElement): void {
  let cleanup: (() => void) | null = null;

  function newRound(seed: number): void {
    if (cleanup) cleanup();
    mount.innerHTML = '';
    cleanup = startRound(seed);
  }

  function startRound(seed: number): () => void {
    const rnd = mulberry32(seed);
    let round = 0, score = 0, typed = '', locked = false;
    let item: Term = GENERATORS[0].make(rnd);

    const sub = el('p', { class: 'sub center' });
    const q = el('div', { class: 'big-q' });
    const a = el('div', { class: 'big-a' });
    const fb = el('div', { class: 'quiz-feedback center' });
    const card = el('div', { class: 'quiz-q' }, sub, q, a, fb);
    const pad = keypad(onKey, ['-']);

    mount.appendChild(el('div', { class: 'game-toolbar' },
      el('button', { class: 'btn', text: 'How to play', onclick: showHelp }),
      el('button', { class: 'btn', text: 'New game', onclick: () => newRound(Math.floor(Math.random() * 1e9)) })));
    mount.appendChild(el('div', { class: 'quiz-wrap' }, card));
    mount.appendChild(pad);
    nextRound();

    function showHelp(): void {
      modal({ title: 'How to play', body: `<b>Goal:</b> predict the next number in ${ROUNDS} sequences of rising difficulty.<br><br>
        1. Study the four numbers — they follow one hidden rule.<br>
        2. Type the number that replaces the <b>?</b> and press Enter.<br>
        3. The rule is revealed before the next round.<br><br>
        Check the <b>differences</b> first, then <b>ratios</b>, then squares or
        the sum of the previous two. Solve 5 of ${ROUNDS} to win.` });
    }

    function nextRound(): void {
      if (round >= ROUNDS) { finish(); return; }
      const level = Math.min(4, 1 + Math.floor(round / 2));
      const pool = GENERATORS.filter((g) => g.d === level);
      item = pool[Math.floor(rnd() * pool.length)].make(rnd);
      typed = ''; locked = false;
      sub.textContent = `Round ${round + 1} of ${ROUNDS} · difficulty ${'★'.repeat(level)}`;
      q.textContent = item.terms.join(',  ') + ',  ?';
      a.textContent = '';
      fb.textContent = 'What comes next?';
      fb.className = 'quiz-feedback center dim';
    }

    function onKey(key: string): void {
      if (locked) return;
      if (key === 'Enter') return submit();
      if (key === 'Backspace') typed = typed.slice(0, -1);
      else if (key === '-' && typed === '') typed = '-';
      else if (/^\d$/.test(key) && typed.replace('-', '').length < 7) typed += key;
      a.textContent = typed;
    }

    function submit(): void {
      if (typed === '' || typed === '-') { toast('Type your answer first'); return; }
      locked = true; round++;
      if (Number(typed) === item.next) {
        score++; sound('good');
        fb.textContent = `Correct! Rule: ${item.rule}.`;
        fb.className = 'quiz-feedback good center';
        setTimeout(nextRound, 1200);
      } else {
        sound('bad');
        fb.textContent = `It was ${item.next} — ${item.rule}.`;
        fb.className = 'quiz-feedback bad center';
        setTimeout(nextRound, 2200);
      }
    }

    function finish(): void {
      const won = score >= Math.ceil(ROUNDS * 0.6);
      sound(won ? 'win' : 'bad');
      const summary = score === ROUNDS
        ? '🔢 Pattern master!'
        : `You solved ${score} of ${ROUNDS}`;
      finishLQRound(score, won, summary);
    }

    function physicalKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || e.key === '-' || /^\d$/.test(e.key)) { e.preventDefault(); onKey(e.key); }
    }
    document.addEventListener('keydown', physicalKey);
    return () => document.removeEventListener('keydown', physicalKey);
  }

  newRound(Math.floor(Math.random() * 1e9));
}

mountLQ('sequence', render);
