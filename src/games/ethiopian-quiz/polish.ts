// Ethiopian Quiz — premium presentation layer (visual/audio only).

import type { FreeQuizPresentation } from '../../platform/freeQuizShell';
import { eqSfx } from './sounds';
import {
  animateCountUp,
  animateHudValue,
  animateScoreCount,
  avgResponseMs,
  createRunStats,
  formatMs,
  launchConfetti,
  praiseFor,
  rankLabel,
  recordAnswer,
  resetDisplayedScore,
  spawnBurst,
  spawnGoldStars,
  spawnParticles,
  spawnScorePopup,
  spawnSparkles,
  type RunStats,
} from './fx';

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

const CIRC = 2 * Math.PI * 42;

let runStats: RunStats = createRunStats();
let questionSeconds = 10;
let lastTickLeft = -1;
let prevScore = 0;

function fxLayer(): HTMLElement {
  return $('#eqFxLayer') ?? document.body;
}

function updateTimerRing(left: number, total: number): void {
  const ring = $('#eqTimerRing');
  const label = $('#eqTimerLabel');
  const wrap = $('#eqTimerWrap');
  if (!ring || !label) return;
  const pct = Math.max(0, Math.min(1, left / total));
  ring.style.strokeDashoffset = String(CIRC * (1 - pct));
  label.textContent = String(Math.max(0, left));

  ring.classList.remove('eq-timer--green', 'eq-timer--yellow', 'eq-timer--orange', 'eq-timer--red');
  wrap?.classList.remove('eq-timer-pulse');
  if (left <= 2) {
    ring.classList.add('eq-timer--red');
    wrap?.classList.add('eq-timer-pulse');
  } else if (left <= 4) {
    ring.classList.add('eq-timer--orange');
    wrap?.classList.add('eq-timer-pulse');
  } else if (left <= 6) {
    ring.classList.add('eq-timer--yellow');
  } else {
    ring.classList.add('eq-timer--green');
  }
}

function updateProgress(qNum: number, total: number): void {
  const label = $('#eqProgressLabel');
  const fill = $('#eqProgressFill');
  if (label) label.textContent = `Question ${qNum} of ${total}`;
  if (fill) {
    const pct = total > 0 ? ((qNum - 1) / total) * 100 : 0;
    fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }
}

function syncHudMirror(ctx: {
  score: number;
  correct: number;
  total: number;
  qNum: number;
  qLeft: number;
}): void {
  animateHudValue($('#eqHudScore'), ctx.score);
  animateHudValue($('#eqHudCorrect'), `${ctx.correct}/${ctx.total}`);
  if (ctx.score !== prevScore) {
    animateScoreCount($('#fqStatScore'), ctx.score);
    prevScore = ctx.score;
  }
  updateTimerRing(ctx.qLeft, questionSeconds);
  updateProgress(ctx.qNum, ctx.total);
}

function paintResults(score: number, correct: number, total: number): void {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgMs = avgResponseMs(runStats);
  const fastest = runStats.fastestMs;

  const set = (id: string, text: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('eqResAccuracy', `${accuracy}%`);
  set('eqResFastest', formatMs(fastest));
  set('eqResAverage', formatMs(avgMs));
  set('eqResStreak', `×${runStats.bestStreak}`);
  set('eqResRank', rankLabel(accuracy));

  const finalEl = $('#finalScore');
  if (finalEl) animateCountUp(finalEl, score, 1100);

  const panel = $('#overOverlay .eq-results-panel');
  if (panel && accuracy >= 70) {
    launchConfetti(panel);
    if (accuracy >= 90) spawnGoldStars(panel);
    eqSfx.victory();
  } else {
    eqSfx.gameOver();
  }
}

function initBgParticles(): void {
  const layer = $('#eqBgParticles');
  if (!layer) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'eq-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 20}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${7 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

function wireMenuCards(): void {
  const hub = '../../';
  const links: Array<[string, string]> = [
    ['#eqCardTourney', `${hub}#featuredTournaments`],
    ['#eqCardDaily', `${hub}#sidebarChallenge`],
    ['#eqCardLb', `${hub}#lbPreview`],
  ];
  for (const [id, href] of links) {
    const el = $(id);
    if (el) {
      el.addEventListener('click', () => {
        eqSfx.menuClick();
        location.href = href;
      });
    }
  }

  $('#eqCardSettings')?.addEventListener('click', () => {
    eqSfx.menuClick();
    $('#eqSettingsPanel')?.classList.toggle('hidden');
  });
  $('#eqSettingsPlayBtn')?.addEventListener('click', () => {
    eqSfx.menuClick();
    $('#eqSettingsPanel')?.classList.toggle('hidden');
  });
  $('#eqSettingsClose')?.addEventListener('click', () => {
    eqSfx.menuClick();
    $('#eqSettingsPanel')?.classList.add('hidden');
  });

  const muteBtn = $('#eqMuteBtn');
  muteBtn?.addEventListener('click', () => {
    const muted = eqSfx.toggleMute();
    muteBtn.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    if (!muted) eqSfx.menuClick();
  });

  $('#eqHomeBtn')?.addEventListener('click', () => {
    eqSfx.menuClick();
    location.href = hub;
  });
  $('#eqLbBtn')?.addEventListener('click', () => {
    eqSfx.menuClick();
    location.href = `${hub}#lbPreview`;
  });
}

function wireOptionPress(): void {
  const opts = $('#fq-options');
  if (!opts) return;
  opts.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.fq-opt');
    if (!btn || btn.disabled) return;
    btn.classList.add('eq-opt-press');
    eqSfx.select();
  });
  opts.addEventListener('pointerup', () => {
    opts.querySelectorAll('.eq-opt-press').forEach((b) => b.classList.remove('eq-opt-press'));
  });
}

export function createEthiopianQuizPresentation(questionSec: number): FreeQuizPresentation {
  questionSeconds = questionSec;
  return {
    onPhase(phase) {
      if (phase === 'playing') {
        runStats = createRunStats();
        resetDisplayedScore();
        prevScore = 0;
        lastTickLeft = -1;
        eqSfx.transition();
      }
      if (phase === 'menu') {
        $('#eqSettingsPanel')?.classList.add('hidden');
      }
    },

    onQuestionShow(ctx) {
      updateProgress(ctx.index, ctx.total);
      const fill = $('#eqProgressFill');
      if (fill) {
        const pct = ctx.total > 0 ? ((ctx.index - 1) / ctx.total) * 100 : 0;
        fill.style.width = `${pct}%`;
      }
      const card = $('#fq-card');
      card?.classList.remove('eq-card-enter');
      void card?.offsetWidth;
      card?.classList.add('eq-card-enter');
    },

    onTimerTick(left, total) {
      updateTimerRing(left, total);
      if (left <= 3 && left !== lastTickLeft && left > 0) eqSfx.tick();
      lastTickLeft = left;
    },

    onStats(ctx) {
      syncHudMirror(ctx);
    },

    onAnswer(ctx) {
      recordAnswer(runStats, ctx.correct, ctx.responseMs);
      const praise = praiseFor(ctx.correct, ctx.qLeft, runStats.currentStreak);
      const card = $('#fq-card');
      const layer = fxLayer();
      if (ctx.correct && card) {
        const r = card.getBoundingClientRect();
        const l = layer.getBoundingClientRect();
        const x = r.left - l.left + r.width / 2;
        const y = r.top - l.top + r.height * 0.35;
        spawnScorePopup(layer, x, y, praise, true);
        spawnSparkles(layer, x, y);
        spawnBurst(layer, x, y);
        spawnParticles(layer, x, y, '#4f9e16', 8);
        if (runStats.currentStreak >= 3) spawnGoldStars(layer);
      }
    },

    onTimeUp() {
      const card = $('#fq-card');
      const layer = fxLayer();
      if (card) {
        const r = card.getBoundingClientRect();
        const l = layer.getBoundingClientRect();
        spawnScorePopup(layer, r.left - l.left + r.width / 2, r.top - l.top + 40, 'Time up!', false);
      }
    },

    onGameOver(ctx) {
      paintResults(ctx.score, ctx.correct, ctx.total);
    },

    onMenuReady() {
      const best = document.querySelector('.shell-free-best strong');
      const mirror = $('#eqMenuBest');
      if (best && mirror) mirror.textContent = best.textContent ?? '—';
    },
  };
}

export function initEthiopianQuizPolish(questionSec: number): FreeQuizPresentation {
  initBgParticles();
  wireMenuCards();
  wireOptionPress();
  updateTimerRing(questionSec, questionSec);
  return createEthiopianQuizPresentation(questionSec);
}

export function ethiopianQuizSfx() {
  return {
    correct: () => eqSfx.correct(),
    wrong: () => eqSfx.wrong(),
    timeUp: () => eqSfx.timeUp(),
    menuClick: () => eqSfx.menuClick(),
  };
}
