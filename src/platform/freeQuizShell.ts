// Continuous timed MCQ shell for free quiz games — menu / pause / game-over,
// shuffled question deck, no answer reveal on wrong picks.

import { applyTranslations, getLang, t } from '../i18n';
import { sfx } from '../engine/audio';
import { createHost } from './gameHost';
import {
  ensureToast,
  renderFreeMenuHtml,
  renderRunRewardHtml,
  startFreeRound,
  submitFreeRun,
} from './freeGameShell';
import { promptIfSessionExpired } from './sessionAuth';
import { isConfigured } from './supabase';
import { freeGameBestRemote } from './backend';

export interface FreeQuizItem {
  prompt: string;
  choices: readonly [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export interface FreeQuizShellConfig {
  gameId: string;
  /** Full question bank — reshuffled at each play / replay. */
  bank: () => FreeQuizItem[];
  /** Session length in seconds (default 60). */
  runSeconds?: number;
  /** Points added per correct answer (default 10). */
  pointsPerCorrect?: number;
  /** Score ≥ this counts as a win (defaults to host.winScore). */
  winScore?: number;
  /** Two-column option grid (spellings). */
  twoColOptions?: boolean;
}

type Phase = 'menu' | 'playing' | 'paused' | 'over';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatRunTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${s}s`;
}

function buildDeck(bank: () => FreeQuizItem[]): FreeQuizItem[] {
  return shuffle(bank());
}

export function wireFreeQuizShell(config: FreeQuizShellConfig): void {
  const host = createHost(config.gameId);
  const runSeconds = config.runSeconds ?? 60;
  const pointsPerCorrect = config.pointsPerCorrect ?? 10;
  const winThreshold = config.winScore ?? host.winScore;

  let phase: Phase = 'menu';
  let starting = false;
  let serverBest = 0;
  let toastT = 0;

  let deck: FreeQuizItem[] = [];
  let deckIdx = 0;
  let answered = 0;
  let correct = 0;
  let locked = false;
  let runStart = 0;
  let runLeft = runSeconds;
  let runTimer: ReturnType<typeof setInterval> | undefined;
  let timerPaused = false;
  let finishPending = false;

  const elQ = $('#fq-question');
  const elOpts = $('#fq-options');
  if (config.twoColOptions) elOpts.classList.add('two-col');

  const toast = ensureToast(`${config.gameId}-toast`);

  function showToast(msg: string): void {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function refreshMenu(): void {
    $('#freeMenu').innerHTML = renderFreeMenuHtml(host, serverBest);
  }

  function showMenu(): void {
    $('#menuOverlay').classList.remove('hidden');
    $('#fqPlayFrame').classList.add('hidden');
    $('#fqBackdrop').classList.remove('hidden');
    hideOverOverlay();
  }

  function showGame(): void {
    $('#menuOverlay').classList.add('hidden');
    $('#fqPlayFrame').classList.remove('hidden');
    $('#fqBackdrop').classList.add('hidden');
  }

  function setPhase(next: Phase): void {
    phase = next;
    if (next === 'menu') showMenu();
    else showGame();
    $('#closeBtn').classList.toggle('hidden', next === 'menu' || next === 'over');
    $('#pauseOverlay').classList.toggle('hidden', next !== 'paused');
  }

  function hideOverOverlay(): void {
    const overlay = $('#overOverlay');
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function showOverOverlay(score: number, isRecord: boolean): void {
    const overlay = $('#overOverlay');
    $('#finalScore').textContent = score.toLocaleString();
    $('#finalBest').textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
    $('#fqOverSummary').textContent = t('eq.correctSummary').replace('{correct}', String(correct));
    $('#newBest').classList.toggle('hidden', !isRecord);
    $('#runReward').innerHTML = '<span class="shell-rr-pending">…</span>';
    $('#closeBtn').classList.add('hidden');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function updateStats(): void {
    const score = correct * pointsPerCorrect;
    $('#fqStatQ').textContent = phase === 'playing' ? String(answered + 1) : String(answered);
    $('#fqStatTime').textContent = phase === 'playing' ? formatRunTime(runLeft) : '—';
    $('#fqStatScore').textContent = String(score);
  }

  function clearRunTimer(): void {
    if (runTimer) {
      clearInterval(runTimer);
      runTimer = undefined;
    }
    timerPaused = false;
  }

  function startRunTimer(): void {
    clearRunTimer();
    timerPaused = false;
    runTimer = setInterval(() => {
      if (phase !== 'playing' || timerPaused) return;
      runLeft--;
      updateStats();
      if (runLeft <= 0) void finishRun();
    }, 1000);
  }

  function nextItem(): FreeQuizItem {
    if (deckIdx >= deck.length) {
      deck = buildDeck(config.bank);
      deckIdx = 0;
    }
    return deck[deckIdx++];
  }

  function beginQuiz(): void {
    deck = buildDeck(config.bank);
    deckIdx = 0;
    answered = 0;
    correct = 0;
    locked = false;
    finishPending = false;
    runLeft = runSeconds;
    runStart = Date.now();
    setPhase('playing');
    showQuestion();
    startRunTimer();
  }

  function showQuestion(): void {
    if (phase !== 'playing' || finishPending) return;
    locked = false;
    const q = nextItem();
    elQ.textContent = q.prompt;
    const order = shuffle([0, 1, 2, 3] as const);
    elOpts.innerHTML = order.map((oi) =>
      `<button type="button" class="fq-opt" data-i="${oi}">${q.choices[oi]}</button>`,
    ).join('');
    elOpts.querySelectorAll<HTMLButtonElement>('.fq-opt').forEach((b) => {
      b.addEventListener('click', () => answer(q, Number(b.dataset.i), b));
    });
    updateStats();
  }

  function answer(q: FreeQuizItem, choice: number, btn: HTMLButtonElement): void {
    if (locked || phase !== 'playing' || finishPending) return;
    locked = true;
    const right = choice === q.answer;
    if (right) {
      correct++;
      btn.classList.add('ok');
      sfx.coin();
    } else {
      btn.classList.add('bad');
      sfx.click();
    }
    answered++;
    updateStats();
    setTimeout(() => {
      if (finishPending || phase !== 'playing') return;
      if (runLeft <= 0) void finishRun();
      else showQuestion();
    }, right ? 450 : 650);
  }

  async function finishRun(): Promise<void> {
    if (finishPending) return;
    finishPending = true;
    clearRunTimer();
    locked = true;
    const score = correct * pointsPerCorrect;
    const isWin = score >= winThreshold;
    const isRecord = score > serverBest;
    if (isRecord) serverBest = score;
    refreshMenu();
    const timeMs = Date.now() - runStart;
    elQ.textContent = '';
    elOpts.innerHTML = '';
    updateStats();
    setPhase('over');
    showOverOverlay(score, isRecord);
    void submitRun(score, isWin, timeMs, isRecord);
  }

  async function submitRun(
    score: number,
    isWin: boolean,
    durationMs: number,
    isRecord: boolean,
  ): Promise<void> {
    const reward = $('#runReward');
    if (!isConfigured()) {
      reward.innerHTML = '';
      $('#finalBest').textContent = serverBest.toLocaleString();
      return;
    }
    reward.innerHTML = '<span class="shell-rr-pending">…</span>';
    const res = await submitFreeRun(host, score, isWin, durationMs);
    if (!res) {
      $('#finalBest').textContent = serverBest.toLocaleString();
      $('#newBest').classList.toggle('hidden', !isRecord);
      if (await promptIfSessionExpired(showToast)) {
        reward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
      } else {
        reward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
      }
      return;
    }
    if (typeof res.best === 'number') serverBest = Math.max(serverBest, res.best);
    $('#finalBest').textContent = serverBest.toLocaleString();
    $('#newBest').classList.toggle('hidden', !isRecord && !res.isRecord);
    reward.innerHTML = renderRunRewardHtml(res);
    refreshMenu();
  }

  async function beginFreeRound(): Promise<void> {
    if (starting) return;
    starting = true;
    try {
      clearRunTimer();
      if (!(await startFreeRound(host, toast))) return;
      hideOverOverlay();
      beginQuiz();
    } finally {
      starting = false;
    }
  }

  async function onPlayOrEnter(): Promise<void> {
    if (starting || phase === 'playing' || phase === 'paused') return;
    await beginFreeRound();
  }

  function pauseQuiz(): void {
    if (phase !== 'playing') return;
    clearRunTimer();
    timerPaused = true;
    setPhase('paused');
  }

  function resumeQuiz(): void {
    if (phase !== 'paused') return;
    setPhase('playing');
    if (timerPaused) {
      timerPaused = false;
      startRunTimer();
    }
  }

  async function restartFromPause(): Promise<void> {
    if (phase !== 'paused') return;
    hideOverOverlay();
    await beginFreeRound();
  }

  $('#startBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#againBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#restartBtn').addEventListener('click', () => void restartFromPause());
  $('#resumeBtn').addEventListener('click', () => resumeQuiz());
  $('#pauseBtn').addEventListener('click', () => pauseQuiz());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') pauseQuiz();
  });

  document.documentElement.lang = getLang();
  applyTranslations();
  refreshMenu();
  setPhase('menu');

  void freeGameBestRemote(config.gameId).then((best) => {
    serverBest = best;
    refreshMenu();
  });
}
