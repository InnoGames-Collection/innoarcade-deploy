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
import { fetchSkins, setSkinRemote } from '../../platform/backend';
import { GameHost } from '../../platform/gameHost';
import {
  standardStateOverlay, wireFreeEngineMain, wireMutePause,
} from '../../platform/freeGameShell';
import { sfx } from '../../engine/audio';
import { TempleDash, W, H, GAME_ID, type GameState } from './game';
import { kenneySheetDefs, skinSheetDefs, DEFAULT_SKIN_ID } from './art';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const host = new GameHost(GAME_ID);

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

  let runStart = 0;

  const scoreVal = $('#scoreVal');
  const coinsVal = $('#coinsVal');
  const biomeVal = $('#biomeVal');
  const powerChips = $('#powerChips');
  let chipSig = '';

  const shell = wireFreeEngineMain({
    host,
    overlays: {
      menu: $('#menuOverlay'),
      paused: $('#pauseOverlay'),
      over: $('#overOverlay'),
    },
    stateOverlay: standardStateOverlay,
    hud: $('#hud'),
    closeBtn: $('#closeBtn'),
    freeMenu: $('#freeMenu'),
    startBtn: $('#startBtn'),
    againBtn: $('#againBtn'),
    restartBtn: $('#restartBtn'),
    resumeBtn: $('#resumeBtn'),
    finalScore: $('#finalScore'),
    finalBest: $('#finalBest'),
    newBest: $('#newBest'),
    runReward: $('#runReward'),
    game,
    getDurationMs: () => Date.now() - runStart,
  });

  const origStart = game.start.bind(game);
  game.start = () => {
    void assetsReady.then(() => {
      runStart = Date.now();
      origStart();
    });
  };

  game.onStateChange = (s: GameState) => {
    if (s === 'over') return;
    shell.showForState(s);
    document.querySelector('#closeBtn')?.classList.toggle('hidden', s !== 'playing');
    if (s === 'menu') shell.refreshMenu();
  };

  game.onGameOver = (score, _coins, record) => {
    shell.handleGameOver(score, record);
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

  $('#pauseBtn').addEventListener('click', () => {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
  });
  $('#settingsBtn').addEventListener('click', () => settingsPanel.toggle());

  wireMutePause($('#muteBtn'), null, game, sfx);
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

  document.documentElement.lang = getLang();
  applyTranslations();
  shell.refreshMenu();
  shell.showForState('menu');
  document.querySelector('#closeBtn')?.classList.add('hidden');

  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => { vp.beginFrame(); game.render(ctx); updateHud(); },
  );
  loop.start();
}
