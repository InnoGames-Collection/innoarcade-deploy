import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { Viewport } from '../../engine/viewport';
import { AssetStore } from '../../engine/assets';
import { Preloader } from '../../ui/preloader';
import { SettingsPanel } from '../../ui/settingsPanel';
import { registerPwa } from '../../engine/pwa';
import { profile } from '../../engine/profile';
import { achievements } from '../../engine/achievements';
import { sfx } from '../../engine/audio';
import { TempleDash, W, H, GAME_ID, SKINS, TD_ACHIEVEMENTS, type GameState } from './game';
import { sheetDefs } from './art';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

registerPwa();
achievements.register(TD_ACHIEVEMENTS);

void boot();

async function boot(): Promise<void> {
  const pre = new Preloader('Temple Dash');
  const assets = new AssetStore();
  await assets.load(sheetDefs(), (p) => pre.set(p));
  pre.done();
  run(assets);
}

function run(assets: AssetStore): void {
  const canvas = $('#game') as unknown as HTMLCanvasElement;
  const vp = new Viewport(canvas, W, H);
  const ctx = vp.ctx;
  const game = new TempleDash(assets);

  const settingsPanel = new SettingsPanel();

  achievements.onUnlock = (def) => {
    profile.addCoins(def.reward);
    const title = getLang() === 'am' ? def.titleAm : def.titleEn;
    showToast(`🏆 ${title}  +${def.reward}🪙`);
    updateWallet();
  };

  // --- HUD ---
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
  }

  game.onStateChange = (s) => {
    showOverlay(s);
    if (s === 'over' || s === 'menu') { updateWallet(); buildShop(); }
  };
  game.onGameOver = (score, coins, record) => {
    $('#finalScore').textContent = String(score);
    $('#finalCoins').textContent = String(coins);
    $('#finalBest').textContent = String(game.best);
    $('#newBest').classList.toggle('hidden', !record);
  };

  // --- input ---
  const input = new Input(document.body);
  input.onAction((a) => {
    if (a === 'pause') {
      if (game.state === 'playing') game.pause();
      else if (game.state === 'paused') game.resume();
      return;
    }
    game.handleAction(a);
  });

  // --- buttons ---
  const FTUE_KEY = 'innoarcade.td.ftue';
  function beginPlay(): void {
    if (!localStorage.getItem(FTUE_KEY)) {
      $('#ftue').classList.remove('hidden');
      return;
    }
    game.start();
  }
  $('#startBtn').addEventListener('click', beginPlay);
  $('#ftueBtn').addEventListener('click', () => {
    localStorage.setItem(FTUE_KEY, '1');
    $('#ftue').classList.add('hidden');
    game.start();
  });
  $('#againBtn').addEventListener('click', () => game.start());
  $('#restartBtn').addEventListener('click', () => game.start());
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

  // --- skin shop ---
  function thumbFor(id: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = 72;
    const tctx = c.getContext('2d')!;
    assets.draw(tctx, `char_${id}`, 0, 0, -6, 72, 72);
    return c;
  }
  function buildShop(): void {
    const row = $('#skinRow');
    row.innerHTML = '';
    const selected = profile.selectedSkin(GAME_ID, 'scout');
    for (const skin of SKINS) {
      const owned = skin.cost === 0 || profile.isUnlocked(GAME_ID, skin.id);
      const isSel = selected === skin.id;
      const chip = document.createElement('div');
      chip.className = `skin-chip${isSel ? ' is-selected' : ''}${owned ? '' : ' is-locked'}`;
      chip.appendChild(thumbFor(skin.id));
      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = getLang() === 'am' ? skin.nameAm : skin.nameEn;
      chip.appendChild(name);
      const action = document.createElement('div');
      action.className = 'skin-action';
      action.textContent = isSel ? t('td.selected') : owned ? t('td.select') : `🪙 ${skin.cost}`;
      chip.appendChild(action);
      chip.addEventListener('click', () => {
        if (isSel) return;
        if (owned) { game.setSkin(skin.id); sfx.click(); buildShop(); }
        else if (profile.spendCoins(skin.cost)) {
          profile.unlock(GAME_ID, skin.id); game.setSkin(skin.id);
          sfx.coin(); updateWallet(); buildShop();
        } else {
          chip.classList.add('shake');
          showToast(t('td.need'));
          setTimeout(() => chip.classList.remove('shake'), 400);
        }
      });
      row.appendChild(chip);
    }
  }
  function updateWallet(): void { $('#walletVal').textContent = String(profile.coins); }

  // --- toast ---
  let toastT = 0;
  function showToast(msg: string): void {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // --- HUD per-frame ---
  function updateHud(): void {
    scoreVal.textContent = String(game.score);
    coinsVal.textContent = String(game.coins);
    biomeVal.textContent = game.biomeName;

    const chips: string[] = [];
    if (game.magnetT > 0) chips.push(`<span class="chip magnet">🧲 ${game.magnetT.toFixed(0)}</span>`);
    if (game.shield) chips.push(`<span class="chip shield">🛡️</span>`);
    if (game.multT > 0) chips.push(`<span class="chip mult">2× ${game.multT.toFixed(0)}</span>`);
    const sig = chips.join('');
    if (sig !== chipSig) { powerChips.innerHTML = sig; chipSig = sig; }
  }

  applyTranslations();
  buildShop();
  updateWallet();
  showOverlay('menu');

  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => { vp.beginFrame(); game.render(ctx); updateHud(); },
  );
  loop.start();

  // QA hook: ?auto starts a run immediately (used for headless screenshots).
  if (location.search.includes('auto')) {
    localStorage.setItem(FTUE_KEY, '1');
    game.start();
  }
}
