/** Mode picker for tube-sort games. */

import './modes.css';
import { el } from '../../_lq/lq';
import { GEM_IDS, gemClassesByIndex } from '../premiumGems';
import { t } from '../../../i18n';
import { collectedGems, gemCatalogProgress, type SessionMode } from './meta';

const BALL_MODE_ICONS: Record<string, string> = {
  classic: '🎯',
  daily: '📅',
  endless: '♾️',
  tournament: '🏆',
};

const WATER_MODE_ILLUSTRATIONS: Record<string, string> = {
  classic: '🧪',
  endless: '🌊',
  daily: '💧',
  tournament: '🏆',
};

function renderWaterSortModeMenu(
  mount: HTMLElement,
  onStart: (mode: SessionMode) => void,
): void {
  document.body.classList.add('ws-at-mode-menu');

  const wrap = el('div', { class: 'ws-mode-screen' });

  const hero = el('div', { class: 'ws-mode-hero' });
  const heroArt = el('div', { class: 'ws-mode-hero__art', 'aria-hidden': 'true' });
  heroArt.appendChild(el('span', { class: 'ws-mode-hero__tube ws-mode-hero__tube--a' }));
  heroArt.appendChild(el('span', { class: 'ws-mode-hero__tube ws-mode-hero__tube--b' }));
  heroArt.appendChild(el('span', { class: 'ws-mode-hero__tube ws-mode-hero__tube--c' }));
  hero.appendChild(heroArt);
  hero.appendChild(el('h1', { class: 'ws-mode-hero__title', text: t('ts.modes.title') }));
  hero.appendChild(el('p', { class: 'ws-mode-hero__sub', text: t('ts.modes.sub') }));
  wrap.appendChild(hero);

  const grid = el('div', { class: 'ws-mode-grid' });

  const cards: Array<{
    id: SessionMode | 'tournament';
    label: string;
    desc: string;
    locked?: boolean;
  }> = [
    { id: 'classic', label: t('ts.mode.classic'), desc: t('ts.mode.classicDesc') },
    { id: 'endless', label: t('ts.mode.endless'), desc: t('ts.mode.endlessDesc') },
    { id: 'tournament', label: 'Tournament', desc: 'Compete nationwide', locked: true },
    { id: 'daily', label: t('ts.mode.daily'), desc: t('ts.mode.dailyDesc') },
  ];

  for (const m of cards) {
    if (m.locked) {
      const card = el('div', {
        class: `ws-mode-card ws-mode-card--${m.id} ws-mode-card--locked`,
        'aria-disabled': 'true',
      });
      card.appendChild(el('span', {
        class: 'ws-mode-card__illus',
        text: WATER_MODE_ILLUSTRATIONS[m.id] ?? '🏆',
      }));
      card.appendChild(el('span', { class: 'ws-mode-card__label', text: m.label }));
      card.appendChild(el('span', { class: 'ws-mode-card__desc', text: m.desc }));
      card.appendChild(el('span', { class: 'ws-mode-card__badge', text: 'Soon' }));
      grid.appendChild(card);
    } else {
      const btn = el('button', {
        type: 'button',
        class: `ws-mode-card ws-mode-card--${m.id}`,
        onclick: () => {
          document.body.classList.remove('ws-at-mode-menu');
          onStart(m.id as SessionMode);
        },
      });
      btn.appendChild(el('span', {
        class: 'ws-mode-card__illus',
        text: WATER_MODE_ILLUSTRATIONS[m.id] ?? '💧',
      }));
      btn.appendChild(el('span', { class: 'ws-mode-card__label', text: m.label }));
      btn.appendChild(el('span', { class: 'ws-mode-card__desc', text: m.desc }));
      grid.appendChild(btn);
    }
  }

  wrap.appendChild(grid);
  mount.appendChild(wrap);
}

export function renderModeMenu(
  mount: HTMLElement,
  gameId: string,
  gemVariant: 'liquid' | 'sphere',
  onStart: (mode: SessionMode) => void,
): void {
  if (gameId === 'water-sort') {
    renderWaterSortModeMenu(mount, onStart);
    return;
  }

  const isBallSort = gameId === 'ball-sort';
  const modeIcons = BALL_MODE_ICONS;
  const { collected, total } = gemCatalogProgress(gameId);
  const owned = new Set(collectedGems(gameId));

  const wrap = el('div', { class: 'ts-modes' });
  wrap.appendChild(el('h2', { class: 'ts-modes-title', text: t('ts.modes.title') }));
  wrap.appendChild(el('p', { class: 'ts-modes-sub', text: t('ts.modes.sub') }));

  const grid = el('div', { class: 'ts-modes-grid' });
  const modes: Array<{ id: SessionMode; label: string; desc: string }> = [
    { id: 'classic', label: t('ts.mode.classic'), desc: t('ts.mode.classicDesc') },
    { id: 'daily', label: t('ts.mode.daily'), desc: t('ts.mode.dailyDesc') },
    { id: 'endless', label: t('ts.mode.endless'), desc: t('ts.mode.endlessDesc') },
  ];
  for (const m of modes) {
    const btn = el('button', {
      type: 'button',
      class: `ts-mode-card ts-mode-card--${m.id}`,
      onclick: () => onStart(m.id),
    });
    if (isBallSort) {
      btn.appendChild(el('span', { class: 'ts-mode-card__icon', text: modeIcons[m.id] ?? '⚪' }));
      const body = el('div', { class: 'ts-mode-card__body' });
      body.appendChild(el('span', { class: 'ts-mode-card__label', text: m.label }));
      body.appendChild(el('span', { class: 'ts-mode-card__desc', text: m.desc }));
      btn.appendChild(body);
      btn.appendChild(el('span', { class: 'ts-mode-card__arrow', text: '›' }));
    } else {
      btn.appendChild(el('span', { class: 'ts-mode-card__label', text: m.label }));
      btn.appendChild(el('span', { class: 'ts-mode-card__desc', text: m.desc }));
    }
    grid.appendChild(btn);
  }

  if (isBallSort) {
    const tourney = el('div', {
      class: 'ts-mode-card ts-mode-card--tournament ts-mode-card--locked',
      'aria-disabled': 'true',
    });
    tourney.appendChild(el('span', { class: 'ts-mode-card__icon', text: modeIcons.tournament }));
    const tBody = el('div', { class: 'ts-mode-card__body' });
    tBody.appendChild(el('span', { class: 'ts-mode-card__label', text: 'Tournament' }));
    tBody.appendChild(el('span', {
      class: 'ts-mode-card__desc',
      text: 'Compete with players nationwide. Coming soon.',
    }));
    tourney.appendChild(tBody);
    tourney.appendChild(el('span', { class: 'ts-mode-card__badge', text: 'Locked' }));
    grid.appendChild(tourney);
  }

  wrap.appendChild(grid);

  const catalog = el('div', { class: 'ts-gem-catalog' });
  catalog.appendChild(el('h3', {
    class: 'ts-gem-catalog-title',
    text: `${t('ts.gems.title')} · ${collected}/${total}`,
  }));
  const gems = el('div', { class: 'ts-gem-catalog-grid' });
  GEM_IDS.forEach((id, idx) => {
    const cell = el('div', {
      class: 'ts-gem-cell'
        + (owned.has(id) ? ' ts-gem-cell--owned' : ' ts-gem-cell--locked'),
      title: id,
    });
    if (owned.has(id)) {
      cell.appendChild(el('div', {
        class: `ts-gem-icon ${gemClassesByIndex(idx, gemVariant)}`,
      }));
    } else {
      cell.appendChild(el('span', { class: 'ts-gem-lock', text: '?' }));
    }
    gems.appendChild(cell);
  });
  catalog.appendChild(gems);
  wrap.appendChild(catalog);
  mount.appendChild(wrap);
}
