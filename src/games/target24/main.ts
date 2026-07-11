// Make 24 — combine four numbers with + − × ÷ to reach exactly 24. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, toast, finishLQRound, mulberry32, randInt, sound, mountLQ, setLQHeader } from '../_lq/lq';
import { multiPuzzleScore } from '../_lq/scoring';
import { escalateTier, scalingPenalty, tierLerp } from '../../platform/freeDifficulty';
import { createHost } from '../../platform/gameHost';

const TARGET = 24, ROUNDS = 5, EPS = 1e-9;
const host = createHost('target24');

function solve(nums: number[]): boolean {
  if (nums.length === 1) return Math.abs(nums[0] - TARGET) < EPS;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const a = nums[i], b = nums[j];
      const ops = [a + b, a - b, a * b];
      if (Math.abs(b) > EPS) ops.push(a / b);
      for (const v of ops) { if (solve(rest.concat([v]))) return true; }
    }
  }
  return false;
}

function generate(rnd: () => number, tier: number): number[] {
  const lo = Math.round(tierLerp(1, 3, tier, 3));
  const hi = Math.round(tierLerp(7, 9, tier, 3));
  for (let attempt = 0; attempt < 80; attempt++) {
    const nums = [0, 0, 0, 0].map(() => randInt(lo, hi, rnd));
    if (solve(nums)) return nums;
  }
  for (;;) {
    const nums = [0, 0, 0, 0].map(() => randInt(1, 9, rnd));
    if (solve(nums)) return nums;
  }
}

interface Num { val: number; label: string; used: boolean; }

function render(mount: HTMLElement): void {
  let cleanup: (() => void) | null = null;

  function newRound(seed: number): void {
    if (cleanup) cleanup();
    mount.innerHTML = '';
    cleanup = startRound(seed);
  }

  function startRound(seed: number): () => void {
    const rnd = mulberry32(seed);
    let round = 0;
    let solvedCount = 0;
    let undoCount = 0;
    let penaltyTotal = 0;
    const t0 = Date.now();
    let nums: Num[] = [];
    let history: Num[][] = [];
    let selIdx = -1;
    let selOp: string | null = null;

    const chips = el('div', { class: 'chips' });
    const fb = el('div', { class: 'quiz-feedback center' });
    const ops = el('div', { class: 'op-row' });
    const opEls: Record<string, { btn: HTMLElement; fn: (a: number, b: number) => number | null }> = {};
    const opDefs: Array<[string, (a: number, b: number) => number | null]> = [
      ['+', (a, b) => a + b], ['−', (a, b) => a - b], ['×', (a, b) => a * b], ['÷', (a, b) => (b === 0 ? null : a / b)],
    ];
    for (const [sym, fn] of opDefs) {
      const b = el('button', { class: 'op-btn', text: sym, 'aria-label': sym, onclick: () => pickOp(sym) });
      opEls[sym] = { btn: b, fn };
      ops.appendChild(b);
    }

    mount.appendChild(el('div', { class: 'quiz-wrap' }, el('div', { class: 'quiz-q' }, chips, ops, fb)));
    mount.appendChild(el('div', { class: 'game-toolbar' },
      el('button', { class: 'lq-play-btn', text: 'Undo', 'aria-label': 'Undo', onclick: undo })));
    updateHeader();
    nextRound();

    function liveScore(): number {
      return Math.max(0, solvedCount * 10 - penaltyTotal);
    }

    function updateHeader(): void {
      setLQHeader({
        round: `${Math.min(round + 1, ROUNDS)}/${ROUNDS}`,
        score: String(liveScore()),
      });
    }

    function nextRound(): void {
      if (round >= ROUNDS) { finish(); return; }
      const tier = escalateTier(round, 3, 1);
      const vals = generate(rnd, tier);
      nums = vals.map((v) => ({ val: v, label: String(v), used: false }));
      history = []; selIdx = -1; selOp = null;
      fb.textContent = '';
      fb.className = 'quiz-feedback center';
      updateHeader();
      paint();
    }

    function paint(): void {
      chips.innerHTML = '';
      nums.forEach((n, i) => {
        if (n.used) return;
        chips.appendChild(el('button', { class: 'num-chip' + (i === selIdx ? ' sel' : ''), text: n.label, onclick: () => pickNum(i) }));
      });
      for (const k of Object.keys(opEls)) opEls[k].btn.classList.toggle('sel', selOp === k);
    }

    function pickNum(i: number): void {
      if (selIdx === -1 || selOp === null) { selIdx = i; selOp = null; paint(); return; }
      if (i === selIdx) { selIdx = -1; selOp = null; paint(); return; }
      const a = nums[selIdx], b = nums[i];
      const v = opEls[selOp].fn(a.val, b.val);
      if (v === null) { sound('bad'); toast("Can't divide by zero"); return; }
      history.push(nums.map((n) => ({ ...n })));
      a.used = true; b.used = true;
      const pretty = Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
      nums.push({ val: v, label: pretty, used: false });
      selIdx = -1; selOp = null;
      paint();
      const left = nums.filter((n) => !n.used);
      if (left.length === 1) {
        if (Math.abs(left[0].val - TARGET) < EPS) {
          sound('win'); solvedCount++; round++;
          fb.textContent = `🎯 ${TARGET}! Nailed it.`;
          fb.className = 'quiz-feedback good center';
          updateHeader();
          setTimeout(nextRound, 1100);
        } else {
          sound('bad');
          fb.textContent = `That's ${left[0].label}, not ${TARGET} — undo and retry.`;
          fb.className = 'quiz-feedback bad center';
        }
      }
    }

    function pickOp(sym: string): void {
      if (selIdx === -1) { toast('Pick a number first'); return; }
      selOp = sym; paint();
    }

    function undo(): void {
      if (!history.length) { toast('Nothing to undo'); return; }
      nums = history.pop()!;
      selIdx = -1; selOp = null;
      undoCount++;
      penaltyTotal += scalingPenalty(undoCount);
      updateHeader();
      fb.textContent = '';
      fb.className = 'quiz-feedback center';
      paint();
    }

    function finish(): void {
      const elapsedMs = Date.now() - t0;
      const base = multiPuzzleScore(solvedCount, elapsedMs, { budgetSec: 180 });
      const score = Math.max(0, base - penaltyTotal);
      const won = score >= host.winScore;
      sound(won ? 'win' : 'bad');
      finishLQRound(score, won, `${solvedCount}/${ROUNDS} solved`, elapsedMs);
    }

    return () => {};
  }

  newRound(Math.floor(Math.random() * 1e9));
}

mountLQ('target24', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});

