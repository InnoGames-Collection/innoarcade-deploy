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
import { fetchSkins, setSkinRemote } from '../../platform/backend';
import {
  getRunnerTournament, getMyEntry, enterRunnerTournament, submitRunnerRun, runnerLeaderboard,
  InsufficientCoinsError, type RunnerTournament, type RunnerEntry, type RunnerLeaderRow, type RunnerSubmitResult,
} from '../../platform/runner';
import { balance } from '../../platform/wallet';
import { SignInRequiredError } from '../../platform/payments';
import { isConfigured } from '../../platform/supabase';
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
    const title = getLang() === 'am' ? def.titleAm : def.titleEn;
    showToast(`🏆 ${title}`);
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
    if (s === 'over' || s === 'menu') { buildShop(); void refreshTourney(); }
  };
  game.onGameOver = (score, coins, record, durationMs) => {
    $('#finalScore').textContent = String(score);
    $('#finalCoins').textContent = String(coins);
    $('#finalBest').textContent = String(game.best);
    $('#newBest').classList.toggle('hidden', !record);
    void submitRun(score, durationMs);
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
  let ftueSeen = false; // session-only (no local storage)
  function beginPlay(): void {
    if (!ftueSeen) { $('#ftue').classList.remove('hidden'); return; }
    game.start();
  }
  $('#startBtn').addEventListener('click', beginPlay);
  $('#ftueBtn').addEventListener('click', () => {
    ftueSeen = true;
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
    // Kenney player ~66x92 — draw the stand pose centered, preserving aspect.
    const w = 72 * 0.72;
    assets.draw(tctx, `${id}_stand`, 0, (72 - w) / 2, 2, w, 68);
    return c;
  }
  // Runners are all free; the selection persists on the server profile (skins
  // column). No local coins/unlocks — the economy is server-only.
  let selectedSkin = 'boy';
  function buildShop(): void {
    const row = $('#skinRow');
    row.innerHTML = '';
    for (const skin of SKINS) {
      const isSel = selectedSkin === skin.id;
      const chip = document.createElement('div');
      chip.className = `skin-chip${isSel ? ' is-selected' : ''}`;
      chip.appendChild(thumbFor(skin.id));
      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = getLang() === 'am' ? skin.nameAm : skin.nameEn;
      chip.appendChild(name);
      const action = document.createElement('div');
      action.className = 'skin-action';
      action.textContent = isSel ? t('td.selected') : t('td.select');
      chip.appendChild(action);
      chip.addEventListener('click', () => {
        if (isSel) return;
        selectedSkin = skin.id;
        game.setSkin(skin.id);
        void setSkinRemote(GAME_ID, skin.id);
        sfx.click();
        buildShop();
      });
      row.appendChild(chip);
    }
  }
  // Apply the player's saved runner from their server profile.
  void fetchSkins().then((sk) => {
    selectedSkin = sk[GAME_ID] ?? 'boy';
    game.setSkin(selectedSkin);
    buildShop();
  });

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

  // --- Runner economy (server-only; no caches) ------------------------------
  // XP/score/leaderboard all live on the server (platform/runner.ts). Free runs
  // earn XP; entering the tournament (one coin fee → N attempts) makes the best
  // run rank on the leaderboard.
  let tourney: RunnerTournament | null = null;
  let myEntry: RunnerEntry | null = null;
  let walletCoins = 0;

  const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const medal = (rank: number): string => ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;

  function boardHtml(rows: RunnerLeaderRow[]): string {
    if (!rows.length) return `<p class="rb-empty">${t('td.noBoard')}</p>`;
    return rows.map((r) => `
      <div class="rb-row${r.isPlayer ? ' me' : ''}">
        <span class="rb-rank">${medal(r.rank)}</span>
        <span class="rb-name">${escHtml(r.isPlayer ? t('td.you') : r.name)}</span>
        <span class="rb-score">${r.score.toLocaleString()}</span>
      </div>`).join('');
  }

  async function refreshTourney(): Promise<void> {
    if (!isConfigured()) { $('#runnerTourney').innerHTML = ''; return; }
    tourney = await getRunnerTournament();
    if (!tourney) { $('#runnerTourney').innerHTML = ''; return; }
    [myEntry, walletCoins] = await Promise.all([getMyEntry(tourney.id), balance()]);
    const board = await runnerLeaderboard(tourney.id, 5);

    const left = myEntry?.attemptsLeft ?? 0;
    const status = left > 0
      ? `<span class="rt-attempts">🎟️ ${t('td.attemptsLeft')}: <strong>${left}</strong></span>`
      : `<span class="rt-fee">${tourney.entryFeeCoins} 🪙 → ${tourney.attempts} ${t('td.attempts')}</span>`;
    const btn = `<button id="enterBtn" class="btn rt-enter">${t('td.enterFor')} · ${tourney.entryFeeCoins} 🪙</button>`;

    $('#runnerTourney').innerHTML = `
      <div class="rt-head">
        <span class="rt-title">🏆 ${escHtml(getLang() === 'am' ? tourney.titleAm : tourney.titleEn)}</span>
        <span class="rt-coins">${walletCoins.toLocaleString()} 🪙</span>
      </div>
      <div class="rt-status">${status}${btn}</div>
      <div class="runner-board">${boardHtml(board)}</div>`;

    $('#enterBtn').addEventListener('click', onEnter);
  }

  async function onEnter(): Promise<void> {
    const b = document.querySelector<HTMLButtonElement>('#enterBtn');
    if (b) b.disabled = true;
    try {
      myEntry = await enterRunnerTournament();
      await refreshTourney();
      showToast(`🎟️ ${t('td.attemptsLeft')}: ${myEntry.attemptsLeft}`);
    } catch (e) {
      if (e instanceof InsufficientCoinsError) showToast(`🪙 ${t('td.needCoins')}`);
      else if (e instanceof SignInRequiredError) showToast(t('td.signInToRank'));
      else showToast('✕');
      if (b) b.disabled = false;
    }
  }

  async function submitRun(score: number, durationMs: number): Promise<void> {
    const reward = $('#runReward');
    const boardOver = $('#runnerBoardOver');
    if (!isConfigured()) { reward.innerHTML = ''; boardOver.innerHTML = ''; return; }
    reward.innerHTML = `<span class="rr-pending">…</span>`;
    let res: RunnerSubmitResult | null = null;
    try {
      res = await submitRunnerRun(score, durationMs);
    } catch (e) {
      reward.innerHTML = `<span class="rr-note">${e instanceof SignInRequiredError ? t('td.signInToRank') : '✕'}</span>`;
      return;
    }
    if (!res) { reward.innerHTML = ''; return; }
    const rankLine = res.ranked
      ? `<span class="rr-stat"><b>${t('td.rank')}</b> #${res.rank}/${res.total}</span>`
      : `<span class="rr-note">${t('td.notRanked')}</span>`;
    reward.innerHTML = `
      <span class="rr-stat xp">+${res.award} ${t('td.xpGained')}</span>
      <span class="rr-stat"><b>${t('td.level')}</b> ${res.level}</span>
      ${rankLine}`;
    if (tourney) boardOver.innerHTML = boardHtml(await runnerLeaderboard(tourney.id, 5));
    void refreshTourney();
  }

  applyTranslations();
  buildShop();
  void refreshTourney();
  showOverlay('menu');

  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => { vp.beginFrame(); game.render(ctx); updateHud(); },
  );
  loop.start();

  // QA hook: ?auto starts a run immediately (used for headless screenshots).
  if (location.search.includes('auto')) {
    ftueSeen = true;
    game.start();
  }
}
