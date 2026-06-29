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
import { fetchSkins, setSkinRemote, leaderboardRemote, playerStandingRemote } from '../../platform/backend';
import { GameHost } from '../../platform/gameHost';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import {
  getTournamentForGame, loadTournaments, loadMyEntries, myEntry,
  type Tournament, type LeaderEntry,
} from '../../platform/tournaments';
import { balance } from '../../platform/wallet';
import { isConfigured } from '../../platform/supabase';
import { currentUser } from '../../platform/auth';
import { sfx } from '../../engine/audio';
import { TempleDash, W, H, GAME_ID, SKINS, type GameState } from './game';
import { sheetDefs, skinThumbUrl } from './art';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

registerPwa();

void boot();

async function boot(): Promise<void> {
  const pre = new Preloader('Ethiorunner');
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
    if (s === 'over' || s === 'menu') { buildShop(); void refreshTourney(); }
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
    try {
      await host.startRound();
      game.best = serverBest;
      game.start();
      updateActionButtons();
    } catch {
      showToast(t('td.signInToRank'));
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

  let selectedSkin = 'champion';
  function thumbFor(id: string): HTMLElement {
    const img = document.createElement('img');
    img.className = 'skin-thumb-img';
    img.src = skinThumbUrl(id);
    img.alt = '';
    img.draggable = false;
    return img;
  }

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

  void fetchSkins().then((sk) => {
    selectedSkin = sk[GAME_ID] ?? 'champion';
    game.setSkin(selectedSkin);
    buildShop();
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

  const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const medal = (rank: number): string => ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;

  function attemptsLeft(): number {
    return tourney ? (myEntry(tourney.id)?.left ?? 0) : 0;
  }

  function updateActionButtons(): void {
    const left = attemptsLeft();
    const startBtn = document.querySelector<HTMLButtonElement>('#startBtn');
    const againBtn = document.querySelector<HTMLButtonElement>('#againBtn');
    const restartBtn = document.querySelector<HTMLButtonElement>('#restartBtn');
    const playLabel = left > 0
      ? `▶ ${t('td.playTournament')} · 🎟️ ${left}`
      : t('td.playTournament');

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
      restartBtn.textContent = left > 0 ? t('td.restart') : t('td.playTournament');
    }
  }

  async function onPlayOrEnter(): Promise<void> {
    if (attemptsLeft() > 0) await startRun();
    else await onEnter();
  }

  function boardHtml(rows: LeaderEntry[]): string {
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

    const entry = myEntry(tourney.id);
    const left = entry?.left ?? 0;
    const title = getLang() === 'am' ? tourney.titleAm : tourney.titleEn;

    $('#runnerTourney').innerHTML = `
      <div class="rt-head">
        <span class="rt-title">🏆 ${escHtml(title)}</span>
        <span class="rt-coins">${walletCoins.toLocaleString()} 🪙</span>
      </div>
      <div class="rt-best">${t('td.yourBest')}: <strong>${serverBest.toLocaleString()}</strong></div>
      ${left > 0 ? `<div class="rt-status"><span class="rt-attempts">🎟️ ${t('td.attemptsLeft')}: <strong>${left}</strong></span></div>` : ''}
      <div class="runner-board">${boardHtml(board)}</div>`;

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
    reward.innerHTML = `<span class="rr-pending">…</span>`;
    let res;
    try {
      res = await host.finish(score, score >= host.winScore, durationMs, { ranked: true });
    } catch {
      reward.innerHTML = `<span class="rr-note">${t('td.signInToRank')}</span>`;
      return;
    }
    serverBest = res.best ?? serverBest;
    game.best = serverBest;
    $('#finalBest').textContent = String(serverBest);
    $('#newBest').classList.toggle('hidden', !res.isRecord);
    reward.innerHTML = `<span class="rr-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
      <span class="rr-stat"><b>${t('td.best')}</b> ${serverBest.toLocaleString()}</span>`;
    if (tourney) boardOver.innerHTML = boardHtml(await leaderboardRemote(tourney.id, 5));
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
}
