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
import { fetchSkins, setSkinRemote, fetchWallets, leaderboardRemote, playerStandingRemote } from '../../platform/backend';
import { GameHost } from '../../platform/gameHost';
import {
  getTournamentForGame, loadTournaments, loadMyEntries, myEntry, prizePool, tournamentEntrants,
  enterTournament, InsufficientCoinsError, LevelTooLowError,
  type Tournament, type LeaderEntry,
} from '../../platform/tournaments';
import { levelFor } from '../../platform/config';
import { balance } from '../../platform/wallet';
import { SignInRequiredError } from '../../platform/payments';
import { isConfigured } from '../../platform/supabase';
import { currentUser } from '../../platform/auth';
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
  // Bind the run to the currently-selected tournament + capture whether it's a
  // ranked attempt (entered, attempts left). Done at START so a mid-run tab switch
  // can't change where the score lands.
  // One-line economy explainer — shown on first visit (session-only, no storage),
  // dismissed by ✕ or once the player starts their first run.
  const dismissHint = (): void => $('#runnerHint').classList.add('hidden');
  $('#hintClose').addEventListener('click', dismissHint);

  function startRun(): void {
    dismissHint();
    // Capture at START whether this run is a ranked attempt (banked attempts left)
    // so a mid-run change can't misfile the score.
    rankedThisRun = tourney ? (myEntry(tourney.id)?.left ?? 0) > 0 : false;
    game.start();
  }
  function beginPlay(): void {
    if (!ftueSeen) { $('#ftue').classList.remove('hidden'); return; }
    startRun();
  }
  $('#startBtn').addEventListener('click', beginPlay);
  $('#ftueBtn').addEventListener('click', () => {
    ftueSeen = true;
    $('#ftue').classList.add('hidden');
    startRun();
  });
  $('#againBtn').addEventListener('click', startRun);
  $('#restartBtn').addEventListener('click', startRun);
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

  // --- Tournament economy (unified server system; no caches) ----------------
  // Ethiorunner is the platform's DAILY tournament. XP/score/leaderboard all live
  // on the server (platform/gameHost + tournaments). A free run earns XP; buying a
  // block of attempts (pay-once → N) makes the best run rank on the leaderboard.
  const host = new GameHost(GAME_ID);
  let tourney: Tournament | undefined;
  let walletCoins = 0;
  // Whether the in-flight run is a ranked attempt — captured at run START.
  let rankedThisRun = false;

  const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const medal = (rank: number): string => ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;

  // "ends in 3h 12m" / "2d 4h" for the tournament window.
  function endsIn(endsAt: number): string {
    const ms = Math.max(0, endsAt - Date.now());
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // The big menu Play button reflects whether the next run is a ranked tournament
  // attempt (banked attempts left) or a free XP-only run.
  function updatePlayButton(): void {
    const btn = document.querySelector('#startBtn');
    if (!btn) return;
    const left = tourney ? (myEntry(tourney.id)?.left ?? 0) : 0;
    btn.textContent = left > 0
      ? `▶ ${t('td.playTournament')} · 🎟️ ${left}`
      : `▶ ${t('td.playFree')}`;
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
    // Hydrate the persisted session BEFORE the per-user economy reads, then pull
    // the live tournament + the player's attempt bank from the unified system.
    await currentUser();
    await Promise.all([loadTournaments(), loadMyEntries()]);
    tourney = getTournamentForGame(GAME_ID);
    if (!tourney) { $('#runnerTourney').innerHTML = ''; return; }
    const [w, wallets, serverStanding, board] = await Promise.all([
      balance(), fetchWallets(), playerStandingRemote(tourney.id), leaderboardRemote(tourney.id, 5),
    ]);
    walletCoins = w;
    const myLevel = levelFor(wallets?.lifetime ?? 0);
    // Best is server-authoritative — seed the game's best so the game-over screen
    // reflects the server, not just this session.
    const serverBest = serverStanding?.score ?? 0;
    if (serverBest > game.best) game.best = serverBest;

    // Level-tier funnel (doc §3.2): locked until the player reaches the level.
    const needLevel = tourney.requiredLevel;
    const locked = myLevel < needLevel;
    const entry = myEntry(tourney.id);
    const left = entry?.left ?? 0, used = entry?.used ?? 0, purchased = entry?.purchased ?? 0;
    const pool = prizePool(tourney), entrants = tournamentEntrants(tourney);
    const status = locked
      ? `<span class="rt-fee">🔒 ${t('td.reachLevel')} ${needLevel}</span>`
      : left > 0
        ? `<span class="rt-attempts">🎟️ ${t('td.attemptsLeft')}: <strong>${left}</strong> <small>(${used}/${purchased})</small></span>`
        : `<span class="rt-fee">${tourney.entryFeeCoins} 🪙 → ${tourney.attempts} ${t('td.attempts')}</span>`;
    const btn = locked
      ? `<button class="btn rt-enter" disabled>🔒 L${needLevel}</button>`
      : `<button id="enterBtn" class="btn rt-enter">${left > 0 ? t('td.enterAgain') : t('td.enterFor')} · ${tourney.entryFeeCoins} 🪙 → ${tourney.attempts} ${t('td.attempts')}</button>`;

    $('#runnerTourney').innerHTML = `
      <div class="rt-head">
        <span class="rt-title">🏆 ${escHtml(getLang() === 'am' ? tourney.titleAm : tourney.titleEn)}</span>
        <span class="rt-coins">${walletCoins.toLocaleString()} 🪙</span>
      </div>
      <div class="rt-prize">🏆 ${t('td.prizePool')}: <strong>${pool.toLocaleString()} 🪙</strong> · 🥇 ${Math.round(pool * 0.5).toLocaleString()} 🪙 +5 🎟️ <small>· ${entrants} ${t('td.entrants')}</small></div>
      <div class="rt-meta">⏳ ${t('td.endsIn')} ${endsIn(tourney.endsAt)} · 🏅 ${t('td.bestRanks')}</div>
      <div class="rt-status">${status}${btn}</div>
      <div class="runner-board">${boardHtml(board)}</div>`;

    updatePlayButton();
    document.querySelector('#enterBtn')?.addEventListener('click', onEnter);
  }

  async function onEnter(): Promise<void> {
    const b = document.querySelector<HTMLButtonElement>('#enterBtn');
    if (b) b.disabled = true;
    const fee = tourney?.entryFeeCoins ?? 0;
    try {
      const e = await enterTournament(GAME_ID);
      await refreshTourney();
      showToast(`−${fee} 🪙 · 🎟️ ${e.left} ${t('td.attempts')}`);
    } catch (e) {
      if (e instanceof InsufficientCoinsError) showToast(`🪙 ${t('td.needCoins')}`);
      else if (e instanceof LevelTooLowError) showToast(`🔒 ${t('td.reachLevel')} ${e.requiredLevel}`);
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
    // Open an anti-cheat round token, then submit. A ranked run consumes a banked
    // attempt server-side; otherwise it's a free XP-only run.
    await host.startRound();
    const res = await host.finish(score, score >= host.winScore, durationMs, { ranked: rankedThisRun });
    const ranked = res.ranked ?? false;
    // Reflect the server's authoritative best (ranked runs) on the game-over card.
    if (ranked && (res.best ?? 0) > game.best) {
      game.best = res.best;
      $('#finalBest').textContent = String(res.best);
    }
    const rankLine = ranked
      ? `<span class="rr-stat"><b>${t('td.rank')}</b> #${res.rank}/${res.total}</span>`
      : `<span class="rr-note">${t('td.notRanked')}</span>`;
    reward.innerHTML = `
      <span class="rr-stat xp">+${res.award ?? 0} ${t('td.xpGained')}</span>
      <span class="rr-stat"><b>${t('td.level')}</b> ${levelFor(res.lifetime ?? 0)}</span>
      ${rankLine}`;
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

  // QA hook: ?auto starts a run immediately (used for headless screenshots).
  if (location.search.includes('auto')) {
    ftueSeen = true;
    game.start();
  }
}
