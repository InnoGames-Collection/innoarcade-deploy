import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../i18n';
import { CATALOG, type GameMeta } from '../platform/catalog';
import {
  activeTournaments, featuredTournament, tournamentGame, leaderboard,
  playerStanding, countdown, type Tournament,
} from '../platform/tournaments';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const lang = (): Lang => getLang();
const name = (g: GameMeta): string => (lang() === 'am' ? g.nameAm : g.nameEn);
const genre = (g: GameMeta): string => (lang() === 'am' ? g.genreAm : g.genreEn);
const tTitle = (x: Tournament): string => (lang() === 'am' ? x.titleAm : x.titleEn);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function thumbStyle(g: GameMeta): string {
  return `background:linear-gradient(145deg, ${g.thumb[0]}, ${g.thumb[1]});`;
}

// --- Featured tournament hero ----------------------------------------------
function renderFeatured(): void {
  const host = $('#featured');
  const tour = featuredTournament();
  const game = tour ? tournamentGame(tour) : undefined;
  if (!tour || !game) { host.innerHTML = ''; return; }
  const top3 = leaderboard(tour.id, 3);
  const me = playerStanding(tour.id);

  host.innerHTML = `
    <article class="featured-card" style="${thumbStyle(game)}">
      <div class="fc-info">
        <span class="fc-badge">🏆 ${escapeHtml(tTitle(tour))}</span>
        <h3 class="fc-title">${escapeHtml(name(game))}</h3>
        <p class="fc-genre">${escapeHtml(genre(game))}</p>
        <div class="fc-meta">
          <div class="fc-countdown" id="fcCountdown"></div>
          <div class="fc-prize">${t('hub.prize')}: <strong>${tour.prizeCoins.toLocaleString()}</strong> ${t('hub.coins')} 🪙</div>
        </div>
        <a class="btn primary fc-cta" href="${game.route}">${t('hub.enterNow')}</a>
      </div>
      <div class="fc-board">
        <div class="fc-board-head">${t('hub.leaderboard')}</div>
        <ol class="leader-list">
          ${top3.map((r) => `
            <li class="leader-row${r.isPlayer ? ' me' : ''}">
              <span class="lr-rank">${r.rank}</span>
              <span class="lr-name">${escapeHtml(r.name)}</span>
              <span class="lr-score">${r.score.toLocaleString()}</span>
            </li>`).join('')}
        </ol>
        <div class="fc-yourrank">
          ${me
            ? `${t('hub.yourRank')}: <strong>#${me.rank}</strong>`
            : `<span class="muted-small">${t('hub.unranked')}</span>`}
        </div>
      </div>
      <div class="fc-glyph">${game.icon}</div>
    </article>`;
}

// --- Tournament cards -------------------------------------------------------
function renderTournaments(): void {
  const host = $('#tournamentList');
  const tours = activeTournaments();
  host.innerHTML = tours.map((tour) => {
    const game = tournamentGame(tour);
    if (!game) return '';
    return `
      <article class="tour-card">
        <div class="tc-thumb" style="${thumbStyle(game)}"><span>${game.icon}</span></div>
        <div class="tc-body">
          <span class="live-dot">● ${t('hub.live')}</span>
          <h4>${escapeHtml(tTitle(tour))}</h4>
          <p class="tc-game">${escapeHtml(name(game))}</p>
          <div class="tc-count" data-ends="${tour.endsAt}"></div>
        </div>
        <a class="btn primary tc-cta" href="${game.route}">${t('hub.enterNow')}</a>
      </article>`;
  }).join('');
}

// --- Games grid -------------------------------------------------------------
function renderGames(): void {
  const host = $('#gameGrid');
  // Show every game; tournament titles are playable for free too.
  host.innerHTML = CATALOG.map((g) => `
    <a class="game-card" href="${g.route}">
      <div class="gc-thumb" style="${thumbStyle(g)}">
        <span class="gc-glyph">${g.icon}</span>
        ${g.mode === 'tournament' ? `<span class="gc-tag">🏆 ${t('hub.tournament')}</span>` : ''}
      </div>
      <div class="gc-body">
        <h4>${escapeHtml(name(g))}</h4>
        <p>${escapeHtml(genre(g))}</p>
      </div>
    </a>`).join('');
}

// --- Live countdowns --------------------------------------------------------
const dShort = (): string => (lang() === 'am' ? 'ቀ' : 'd');
const hShort = (): string => (lang() === 'am' ? 'ሰ' : 'h');
const mShort = (): string => (lang() === 'am' ? 'ደ' : 'm');
const sShort = (): string => (lang() === 'am' ? 'ሰ' : 's');

function fmt(end: number): string {
  const c = countdown(end);
  if (c.done) return '—';
  if (c.days > 0) return `${c.days}${dShort()} ${c.hours}${hShort()} ${c.minutes}${mShort()}`;
  return `${c.hours}${hShort()} ${c.minutes}${mShort()} ${c.seconds}${sShort()}`;
}

function tickCountdowns(): void {
  const tour = featuredTournament();
  const fc = document.querySelector('#fcCountdown');
  if (fc && tour) fc.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <span class="cd-val">${fmt(tour.endsAt)}</span>`;
  document.querySelectorAll<HTMLElement>('.tc-count').forEach((el) => {
    const end = Number(el.dataset.ends);
    el.innerHTML = `<span class="cd-label">${t('hub.endsIn')}</span> <strong>${fmt(end)}</strong>`;
  });
}

// --- Render all + language --------------------------------------------------
function renderAll(): void {
  renderFeatured();
  renderTournaments();
  renderGames();
  applyTranslations();
  tickCountdowns();
}

const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  langEn.classList.toggle('active', lang() === 'en');
  langAm.classList.toggle('active', lang() === 'am');
}
function pick(l: Lang): void { setLang(l); syncLangButtons(); renderAll(); }
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

// Nav active-state on scroll.
const sections = ['dashboard', 'tournaments', 'games'];
window.addEventListener('scroll', () => {
  let current = sections[0];
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 120) current = id;
  }
  document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
  });
}, { passive: true });

document.documentElement.lang = getLang();
syncLangButtons();
renderAll();
setInterval(tickCountdowns, 1000);
