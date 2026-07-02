import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, t } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { Viewport } from '../../engine/viewport';
import { AssetStore } from '../../engine/assets';
import { SettingsPanel } from '../../ui/settingsPanel';
import { registerPwa } from '../../engine/pwa';
import { fetchSkins, setSkinRemote } from '../../platform/backend';
import { createHost } from '../../platform/gameHost';
import {
  applyTournamentPlayLabels, promptTournamentEntry, refreshTournamentMenuPanel,
  startTournamentRound, submitTournamentRound, tournamentAttemptsLeft,
} from '../../platform/tournamentGameFlow';
import { sfx } from '../../engine/audio';
import { TempleDash, W, H, GAME_ID, type GameState } from './game';
import { kenneySheetDefs, skinSheetDefs, DEFAULT_SKIN_ID } from './art';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const host = createHost(GAME_ID);

registerPwa();
void boot();

async function boot(): Promise<void> {
  const assets = new AssetStore();
  const assetsReady = (async () => {
    await assets.load(kenneySheetDefs());
    await assets.load(skinSheetDefs());
  })().catch(() => {});
  run(assets, assetsReady);
}

function run(assets: AssetStore, assetsReady: Promise<void>): void {
  const canvas = $('#game') as unknown as HTMLCanvasElement;
  const vp = new Viewport(canvas, W, H);
  const ctx = vp.ctx;
  const game = new TempleDash(assets);
  const settingsPanel = new SettingsPanel();

  let serverBest = 0;
  let rankedThisRun = false;
  let starting = false;

  const scoreVal = $('#scoreVal');
  const coinsVal = $('#coinsVal');
  const biomeVal = $('#biomeVal');
  const powerChips = $('#powerChips');
  let chipSig = '';

  const overlays: Record<string, HTMLElement> = {
    menu: $('#menuOverlay'),
    paused: $('#pauseOverlay'),
    over: $('#overOverlay'),
  };

  let toastT = 0;
  function showToast(msg: string): void {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
  }

  const playButtons = () => ({
    start: document.querySelector<HTMLButtonElement>('#startBtn'),
    again: document.querySelector<HTMLButtonElement>('#againBtn'),
    restart: document.querySelector<HTMLButtonElement>('#restartBtn'),
  });

  function syncUi(): void {
    applyTournamentPlayLabels(GAME_ID, playButtons());
  }

  function showOverlay(state: GameState): void {
    for (const [k, el] of Object.entries(overlays)) el.classList.toggle('hidden', k !== state);
    document.querySelector('#closeBtn')?.classList.toggle('hidden', state !== 'playing');
  }

  async function refreshPanel(): Promise<void> {
    const snap = await refreshTournamentMenuPanel(GAME_ID, $('#shellTourney'));
    if (snap) {
      serverBest = snap.serverBest;
      if (serverBest > game.best) game.best = serverBest;
    }
    syncUi();
  }

  game.onStateChange = (s) => {
    showOverlay(s);
    if (s === 'over' || s === 'menu') void refreshPanel();
    else syncUi();
  };

  game.onGameOver = (score, _coins, record, durationMs) => {
    $('#finalScore').textContent = String(score);
    $('#finalBest').textContent = String(game.best);
    $('#newBest').classList.toggle('hidden', !record);
    void submitTournamentRound(host, GAME_ID, score, score >= host.winScore, durationMs, rankedThisRun, {
      rewardEl: $('#runReward'),
      boardEl: $('#shellBoardOver'),
      showToast,
      onBest: (best, isRecord) => {
        serverBest = best;
        game.best = best;
        $('#finalBest').textContent = best.toLocaleString();
        $('#newBest').classList.toggle('hidden', !isRecord);
      },
      onSync: () => { syncUi(); void refreshPanel(); },
    });
  };

  const input = new Input(document.body);
  input.onAction((a) => {
    if (a === 'pause') {
      if (game.state === 'playing') game.pause();
      else if (game.state === 'paused') game.resume();
      return;
    }
    game.handleAction(a);
  });

  async function onPlayOrEnter(): Promise<void> {
    if (starting || game.state === 'playing' || game.state === 'paused') return;
    if (tournamentAttemptsLeft(GAME_ID) <= 0) {
      promptTournamentEntry(GAME_ID, () => { void refreshPanel(); }, () => { void onPlayOrEnter(); });
      return;
    }
    await beginRun();
  }

  async function beginRun(): Promise<void> {
    if (starting) return;
    starting = true;
    for (const b of Object.values(playButtons())) {
      if (b) { b.disabled = true; b.textContent = '…'; }
    }
    try {
      await assetsReady;
      if (!(await startTournamentRound(host, showToast))) return;
      rankedThisRun = true;
      game.best = serverBest;
      game.start();
    } finally {
      starting = false;
      syncUi();
    }
  }

  async function restartFromPause(): Promise<void> {
    if (game.state !== 'paused') return;
    await beginRun();
  }

  $('#startBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#againBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#restartBtn').addEventListener('click', () => void restartFromPause());
  $('#resumeBtn').addEventListener('click', () => game.resume());
  $('#pauseBtn').addEventListener('click', () => {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
  });
  $('#settingsBtn').addEventListener('click', () => settingsPanel.toggle());

  const muteBtn = $('#muteBtn');
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => { muteBtn.textContent = sfx.toggleMute() ? '🔇' : '🔊'; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

  game.setSkin(DEFAULT_SKIN_ID);
  void fetchSkins().then((sk) => {
    if (sk[GAME_ID] !== DEFAULT_SKIN_ID) void setSkinRemote(GAME_ID, DEFAULT_SKIN_ID);
  });

  function updateHud(): void {
    scoreVal.textContent = String(game.score);
    coinsVal.textContent = String(game.coins);
    if (game.state === 'playing') {
      const tierKeys = { normal: 'td.diffNormal', hard: 'td.diffHard', extreme: 'td.diffExtreme' } as const;
      biomeVal.textContent = `${game.biomeName} · ${t(tierKeys[game.difficultyTier()])}`;
    } else {
      biomeVal.textContent = game.biomeName;
    }
    const chips: string[] = [];
    if (game.magnetT > 0) chips.push(`<span class="chip magnet">🧲 ${game.magnetT.toFixed(0)}</span>`);
    if (game.shield) chips.push(`<span class="chip shield">🛡️</span>`);
    if (game.multT > 0) chips.push(`<span class="chip mult">2× ${game.multT.toFixed(0)}</span>`);
    const sig = chips.join('');
    if (sig !== chipSig) { powerChips.innerHTML = sig; chipSig = sig; }
  }

  applyTranslations();
  void refreshPanel();
  showOverlay('menu');

  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => { vp.beginFrame(); game.render(ctx); updateHud(); },
  );
  loop.start();
}
