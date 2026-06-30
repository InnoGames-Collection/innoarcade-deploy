// Shared multiple-choice quiz runner — ported from the vendored quiz-engine.js.
// Used by Vocabulary, Spell Check and Logic Riddles. A finished run reports to
// the GoPlay GameHost via recordResultAsync (server-only XP; no local store).

import { el, modal, shuffled, sound, recordResultAsync, formatResultBody, showRunReward } from './lq';

export interface Choice { label: string; correct: boolean; }
export interface McqOpts<T> {
  gameId: string;
  rounds: number;
  bank: () => T[];
  renderPrompt: (item: T) => Node;
  choicesFor: (item: T) => Choice[];
  feedback: (item: T, wasCorrect: boolean) => string;
  resultTitle: (score: number, total: number) => string;
  resultBody?: (score: number, total: number) => string;
  choiceCols?: number;
  help?: string;
}

export function mcqQuiz<T>(opts: McqOpts<T>): (mount: HTMLElement) => void {
  return function render(mount: HTMLElement): void {
    function newRun(): void { mount.innerHTML = ''; startRun(); }

    function startRun(): void {
      const items = opts.bank().slice(0, opts.rounds);
      let idx = 0;
      let score = 0;
      let streak = 0;

      const progress = el('div', { class: 'quiz-progress' }, el('div', { class: 'fill' }));
      const qCard = el('div', { class: 'quiz-q' });
      const scoreline = el('div', { class: 'scoreline' });
      const wrap = el('div', { class: 'quiz-wrap' }, progress, qCard, scoreline);
      mount.appendChild(el('div', { class: 'game-toolbar' },
        opts.help ? el('button', { class: 'btn', text: 'How to play', onclick: () => modal({ title: 'How to play', body: opts.help! }) }) : null,
        el('button', { class: 'btn', text: 'Restart', onclick: newRun })));
      mount.appendChild(wrap);

      const fillEl = progress.firstChild as HTMLElement;
      function paintScore(): void {
        scoreline.textContent = `Score ${score}/${idx} · Streak ${streak}`;
        fillEl.style.width = (idx / items.length) * 100 + '%';
      }

      function nextQuestion(): void {
        if (idx >= items.length) { void finish(); return; }
        const item = items[idx];
        qCard.innerHTML = '';
        qCard.appendChild(el('div', { class: 'sub', text: `Question ${idx + 1} of ${items.length}` }));
        qCard.appendChild(opts.renderPrompt(item));
        const fb = el('div', { class: 'quiz-feedback' });
        const choices = shuffled(opts.choicesFor(item));
        const grid = el('div', { class: 'choices' + (opts.choiceCols === 2 ? ' two-col' : '') });
        const btns = choices.map((c) => {
          const b = el('button', { class: 'choice', text: c.label, onclick: () => answer(c, b) });
          grid.appendChild(b);
          return b;
        });
        qCard.appendChild(grid);
        qCard.appendChild(fb);
        paintScore();

        function answer(c: Choice, btn: HTMLElement): void {
          btns.forEach((b) => { (b as HTMLButtonElement).disabled = true; });
          sound(c.correct ? 'good' : 'bad');
          if (c.correct) {
            btn.classList.add('correct');
            score++; streak++;
            fb.className = 'quiz-feedback good';
          } else {
            btn.classList.add('wrong');
            const right = btns[choices.findIndex((x) => x.correct)];
            if (right) right.classList.add('correct');
            streak = 0;
            fb.className = 'quiz-feedback bad';
          }
          fb.textContent = opts.feedback(item, c.correct);
          idx++;
          paintScore();
          setTimeout(nextQuestion, c.correct ? 950 : 2100);
        }
      }

      async function finish(): Promise<void> {
        const won = score >= Math.ceil(items.length * 0.7);
        sound(won ? 'win' : 'bad');
        const res = await recordResultAsync(opts.gameId, { won, score });
        showRunReward(res);
        const body = (opts.resultBody && opts.resultBody(score, items.length)) ||
          `You got <b>${score} of ${items.length}</b> correct.`;
        const reward = formatResultBody(res);
        qCard.innerHTML = '';
        qCard.appendChild(el('div', { class: 'prompt', text: opts.resultTitle(score, items.length) }));
        const div = el('div'); div.innerHTML = body + (reward ? `<div class="shell-run-reward">${reward}</div>` : ''); qCard.appendChild(div);
        qCard.appendChild(el('div', { class: 'mt' }, el('button', { class: 'btn primary', text: 'Play again', onclick: newRun })));
        fillEl.style.width = '100%';
      }

      nextQuestion();
    }

    newRun();
  };
}
