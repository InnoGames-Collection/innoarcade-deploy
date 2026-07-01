import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { Viewport } from '../../engine/viewport';
import { AssetStore } from '../../engine/assets';
import { SettingsPanel } from '../../ui/settingsPanel';
import { registerPwa } from '../../engine/pwa';
import { fetchSkins, setSkinRemote, leaderboardRemote, playerStandingRemote } from '../../platform/backend';
import { GameHost } from '../../platform/gameHost';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import { promptIfSessionExpired } from '../../platform/sessionAuth';
import { renderShellMenuTournamentHtml, tournamentBoardHtml } from '../../platform/gameTournamentPanel';
import { getGame } from '../../platform/catalog';
import {
  getTournamentForGame, loadTournaments, loadMyEntries, myEntry,
  type Tournament,
} from '../../platform/tournaments';
import { balance } from '../../platform/wallet';
import { isConfigured } from '../../platform/supabase';
import { currentUser } from '../../platform/auth';
import { sfx } from '../../engine/audio';
import { TempleDash, W, H, GAME_ID, type GameState } from './game';
import { kenneySheetDefs, skinSheetDefs, DEFAULT_SKIN_ID } from './art';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

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
  const host = new GameHost(GAME_ID);

  let tourney: Tournament | undefined;
  let walletCoins = 0;
  let serverBest = 0;

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

  function showOverlay(state: GameState): void {
    for (const [k, el] of Object.entries(overlays)) el.classList.toggle('hidden', k !== state);
    document.querySelector('#closeBtn')?.classList.toggle('hidden', state !== 'playing');
  }

  game.onStateChange = (s) => {
    showOverlay(s);
    if (s === 'over' || s === 'menu') { void refreshTourney(); }
    else updateActionButtons();
  };

  game.onGameOver = (score, _coins, _record, durationMs) => {
    $('#finalScore').textContent = String(score);
    void submitRun(score, durationMs);
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

  async function startRun(): Promise<void> {
    const left = tourney ? (myEntry(tourney.id)?.left ?? 0) : 0;
    if (!left) {
      await onEnter();
      return;
    }
    const startBtn = document.querySelector<HTMLButtonElement>('#startBtn');
    const againBtn = document.querySelector<HTMLButtonElement>('#againBtn');
    const restartBtn = document.querySelector<HTMLButtonElement>('#restartBtn');
    for (const b of [startBtn, againBtn, restartBtn]) {
      if (b) { b.disabled = true; b.dataset.prevLabel = b.textContent ?? ''; b.textContent = '…'; }
    }
    try {
      await assetsReady;
      await host.startRound();
      game.best = serverBest;
      game.start();
      updateActionButtons();
    } catch {
      if (!(await promptIfSessionExpired(showToast))) showToast(t('td.submitFailed'));
    } finally {
      updateActionButtons();
    }
  }

  $('#startBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#againBtn').addEventListener('click', () => void onPlayOrEnter());
  $('#restartBtn').addEventListener('click', () => void onPlayOrEnter());
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

  let toastT = 0;
  function showToast(msg: string): void {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
  }

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

  function gameTitle(): string {
    const g = getGame(GAME_ID);
    if (!g) return 'Ethiorunner';
    return getLang() === 'am' ? g.nameAm : g.nameEn;
  }

  function gameIcon(): string {
    return getGame(GAME_ID)?.icon ?? '🏃';
  }

  function attemptsLeft(): number {
    return tourney ? (myEntry(tourney.id)?.left ?? 0) : 0;
  }

  function updateActionButtons(): void {
    const left = attemptsLeft();
    const startBtn = document.querySelector<HTMLButtonElement>('#startBtn');
    const againBtn = document.querySelector<HTMLButtonElement>('#againBtn');
    const restartBtn = document.querySelector<HTMLButtonElement>('#restartBtn');
    const playLabel = left > 0
      ? `▶ ${t('hub.play')} · 🎟️ ${left}`
      : t('hub.play');

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = playLabel;
    }
    if (againBtn) {
      againBtn.disabled = false;
      againBtn.textContent = playLabel;
    }
    if (restartBtn) {
      restartBtn.disabled = false;
      restartBtn.textContent = left > 0 ? t('td.restart') : t('hub.play');
    }
  }

  async function onPlayOrEnter(): Promise<void> {
    if (attemptsLeft() > 0) await startRun();
    else await onEnter();
  }

  async function refreshTourney(): Promise<void> {
    if (!isConfigured()) { $('#runnerTourney').innerHTML = ''; return; }
    await currentUser();
    await Promise.all([loadTournaments(), loadMyEntries()]);
    tourney = getTournamentForGame(GAME_ID);
    if (!tourney) { $('#runnerTourney').innerHTML = ''; return; }

    const [w, standing, board] = await Promise.all([
      balance(), playerStandingRemote(tourney.id), leaderboardRemote(tourney.id, 5),
    ]);
    walletCoins = w;
    serverBest = standing?.score ?? 0;
    game.best = serverBest;

    const left = myEntry(tourney.id)?.left ?? 0;

    $('#runnerTourney').innerHTML = renderShellMenuTournamentHtml(
      gameTitle(), gameIcon(), walletCoins, serverBest, left, board,
    );

    updateActionButtons();
  }

  async function onEnter(): Promise<void> {
    if (!tourney) return;
    openTournamentEntryForGame(GAME_ID, {
      onEntered: () => { void refreshTourney(); },
      onPlay: () => { void onPlayOrEnter(); },
    });
  }

  async function submitRun(score: number, durationMs: number): Promise<void> {
    const reward = $('#runReward');
    const boardOver = $('#runnerBoardOver');
    if (!isConfigured()) { reward.innerHTML = ''; boardOver.innerHTML = ''; return; }
    reward.innerHTML = `<span class="shell-rr-pending">…</span>`;
    const res = await host.finish(score, score >= host.winScore, durationMs, { ranked: true });
    if (res.rank == null) {
      if (await promptIfSessionExpired(showToast)) {
        reward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
      } else {
        reward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
        showToast(t('td.submitFailed'));
      }
      return;
    }
    serverBest = res.best ?? serverBest;
    game.best = serverBest;
    $('#finalBest').textContent = String(serverBest);
    $('#newBest').classList.toggle('hidden', !res.isRecord);
    reward.innerHTML = `<span class="shell-rr-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
      <span class="shell-rr-stat"><b>${t('td.best')}</b> ${serverBest.toLocaleString()}</span>`;
    if (tourney) boardOver.innerHTML = tournamentBoardHtml(await leaderboardRemote(tourney.id, 5));
    void refreshTourney();
  }

  applyTranslations();
  void refreshTourney();
  showOverlay('menu');

  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => { vp.beginFrame(); game.render(ctx); updateHud(); },
  );
  loop.start();
}
