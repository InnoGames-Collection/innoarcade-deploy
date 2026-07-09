/** Mode picker + gem catalog overlay for tube-sort games. */

import './modes.css';
import { el } from '../../_lq/lq';
import { GEM_IDS, gemClassesByIndex } from '../premiumGems';
import { t } from '../../../i18n';
import { collectedGems, gemCatalogProgress, type SessionMode } from './meta';

export function renderModeMenu(
  mount: HTMLElement,
  gameId: string,
  gemVariant: 'liquid' | 'sphere',
  onStart: (mode: SessionMode) => void,
): void {
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
    btn.appendChild(el('span', { class: 'ts-mode-card__label', text: m.label }));
    btn.appendChild(el('span', { class: 'ts-mode-card__desc', text: m.desc }));
    grid.appendChild(btn);
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
