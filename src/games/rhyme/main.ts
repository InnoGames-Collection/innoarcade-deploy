// Rhyme Twins — every answer is a pair of rhyming words. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, toast, modal, typeCatcher, recordResult, dayNumber, shuffled, mulberry32, sound, mountLQ } from '../_lq/lq';
import { RHYME, type RhymeItem } from '../_lq/data';

const MAX_TRIES = 4;
const TOTAL = 5;

interface Slot { word: string; cells: HTMLElement[]; typed: string; }

function render(mount: HTMLElement): void {
  let cleanup: (() => void) | null = null;

  function newRound(seed: number): void {
    if (cleanup) cleanup();
    mount.innerHTML = '';
    cleanup = startRound(seed);
  }

  function startRound(seed: number): () => void {
    const rnd = mulberry32(seed);
    const order = shuffled(RHYME, rnd);
    let qIdx = 0, solved = 0;
    let activeKey: ((k: string) => void) | null = null;

    const wrap = el('div', { class: 'quiz-wrap' });
    mount.appendChild(el('div', { class: 'game-toolbar' },
      el('button', { class: 'btn', text: 'How to play', onclick: showHelp }),
      el('button', { class: 'btn', text: 'New set', onclick: () => newRound(Math.floor(Math.random() * 1e9)) })));
    mount.appendChild(wrap);

    function showHelp(): void {
      modal({ title: 'How to play', body: `<b>Goal:</b> solve ${TOTAL} riddles where every answer is a pair of
        <b>rhyming words</b> — “an overweight feline” → <b>FAT CAT</b>.<br><br>
        1. Read the clue; the tiles show how long each word is.<br>
        2. Type the first word, then the second.<br>
        3. Press Guess. You get ${MAX_TRIES} tries per riddle.<br><br>
        Hint reveals both first letters; Reveal shows the answer. Solve 3 of ${TOTAL} to win.` });
    }

    function nextRiddle(): void {
      if (qIdx >= TOTAL) return finish();
      const item: RhymeItem = order[qIdx % order.length];
      let tries = 0, hinted = false, active = 0;

      const fb = el('div', { class: 'quiz-feedback center' });
      const slots = el('div', { class: 'rhyme-slots' });
      const inputs: Slot[] = [];
      [item.w1, item.w2].forEach((w) => {
        const slot = el('div', { class: 'rhyme-slot' });
        const cells: HTMLElement[] = [];
        for (let i = 0; i < w.length; i++) { const t = el('div', { class: 'tile small' }); cells.push(t); slot.appendChild(t); }
        inputs.push({ word: w, cells, typed: '' });
        slots.appendChild(slot);
      });

      const card = el('div', { class: 'quiz-q' },
        el('p', { class: 'sub', text: `Riddle ${qIdx + 1} of ${TOTAL} · ${MAX_TRIES} tries` }),
        el('p', { class: 'prompt', text: '“' + item.clue + '”' }),
        slots,
        el('p', { class: 'sub center dim', text: 'Tap the tiles to type' }),
        el('div', { class: 'game-toolbar' },
          el('button', { class: 'btn', text: 'Hint', onclick: useHint }),
          el('button', { class: 'btn primary', text: 'Guess', onclick: submit }),
          el('button', { class: 'btn', text: 'Reveal', onclick: () => reveal(false) })),
        fb);
      wrap.innerHTML = '';
      wrap.appendChild(card);
      paint();

      function paint(): void {
        inputs.forEach((inp) => inp.cells.forEach((c, j) => {
          c.textContent = inp.typed[j] || '';
          c.classList.toggle('filled', !!inp.typed[j]);
        }));
      }
      function useHint(): void {
        if (hinted) { toast('Hint already used'); return; }
        hinted = true;
        inputs.forEach((inp) => { inp.typed = inp.word[0]; inp.cells[0].textContent = inp.word[0]; inp.cells[0].classList.add('near'); });
        active = 0; paint(); toast('First letters revealed');
      }
      function submit(): void {
        const g1 = inputs[0].typed, g2 = inputs[1].typed;
        if (g1.length < inputs[0].word.length || g2.length < inputs[1].word.length) { toast('Fill in both words'); return; }
        if (g1 === item.w1 && g2 === item.w2) {
          inputs.forEach((inp) => inp.cells.forEach((c) => c.classList.add('good', 'pop')));
          fb.textContent = 'Got it! ' + item.w1.toUpperCase() + ' ' + item.w2.toUpperCase();
          fb.className = 'quiz-feedback good center';
          sound('good'); solved++; qIdx++;
          setTimeout(nextRiddle, 1100);
        } else {
          tries++;
          slots.classList.remove('shake'); void slots.offsetWidth; slots.classList.add('shake');
          sound('bad');
          if (tries >= MAX_TRIES) return reveal(true);
          fb.textContent = `Not quite — ${MAX_TRIES - tries} tries left.`;
          fb.className = 'quiz-feedback bad center';
          inputs.forEach((inp) => { inp.typed = hinted ? inp.word[0] : ''; });
          active = 0; paint();
        }
      }
      function reveal(exhausted: boolean): void {
        inputs.forEach((inp) => { inp.typed = inp.word; inp.cells.forEach((c, j) => { c.textContent = inp.word[j]; c.classList.add('bad'); }); });
        fb.textContent = (exhausted ? 'Out of tries! ' : '') + 'It was: ' + item.w1.toUpperCase() + ' ' + item.w2.toUpperCase();
        fb.className = 'quiz-feedback bad center';
        qIdx++; setTimeout(nextRiddle, 1600);
      }
      function handleKey(key: string): void {
        if (key === 'Enter') return submit();
        if (key === 'Backspace') {
          const inp = inputs[active]; const min = hinted ? 1 : 0;
          if (inp.typed.length > min) inp.typed = inp.typed.slice(0, -1);
          else if (active > 0) active--;
          paint(); return;
        }
        if (/^[a-z]$/.test(key)) {
          const inp = inputs[active];
          if (inp.typed.length < inp.word.length) inp.typed += key;
          if (inp.typed.length === inp.word.length && active < inputs.length - 1) active++;
          paint();
        }
      }
      activeKey = handleKey;
      typeCatcher(handleKey, slots);
    }

    function finish(): void {
      recordResult('rhyme', { won: solved >= Math.ceil(TOTAL * 0.6), score: solved });
      sound(solved >= Math.ceil(TOTAL * 0.6) ? 'win' : 'bad');
      wrap.innerHTML = '';
      wrap.appendChild(el('div', { class: 'quiz-q' },
        el('p', { class: 'prompt', text: solved === TOTAL ? '🎶 Perfect rhymer!' : `You solved ${solved} of ${TOTAL}` }),
        el('div', { class: 'mt' },
          el('button', { class: 'btn primary', text: 'Play again', onclick: () => newRound(Math.floor(Math.random() * 1e9)) }))));
    }

    function physicalKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey || !activeKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        activeKey(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      }
    }
    document.addEventListener('keydown', physicalKey);
    nextRiddle();
    return () => document.removeEventListener('keydown', physicalKey);
  }

  newRound(dayNumber() * 31 + 7);
}

mountLQ('rhyme', render);
