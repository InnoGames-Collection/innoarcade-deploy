// Admin players view — search the roster, adjust balances, and toggle roles.
// Coin adjustments and role changes run through the admin-action Edge Function
// online; offline the roster is synthetic so those controls are read-only.

import { isConfigured } from '../../platform/supabase';
import { listPlayers, adjustCoins, setRole, type AdminPlayer } from '../../platform/admin';
import { t, esc, num } from '../ui';

let mountHost: HTMLElement;
let query = '';

export async function render(host: HTMLElement): Promise<void> {
  mountHost = host;
  const players = await listPlayers(query);
  const online = isConfigured();

  host.innerHTML = `
    <div class="a-toolbar">
      <input class="a-search" id="search" placeholder="${t('search')}" value="${esc(query)}" />
    </div>
    <div class="a-card">
      <table class="a-table">
        <thead><tr>
          <th>${t('name')}</th><th>${t('phone')}</th><th>${t('coins')}</th><th>${t('role')}</th>
          ${online ? `<th>${t('actions')}</th>` : ''}
        </tr></thead>
        <tbody>
          ${players.map((p) => row(p, online)).join('')}
        </tbody>
      </table>
      ${online ? '' : `<p class="a-note">${t('offlineNote')}</p>`}
    </div>`;

  const search = host.querySelector<HTMLInputElement>('#search')!;
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { query = search.value.trim(); void render(mountHost); }
  });
  if (online) wireRowActions(host, players);
}

function row(p: AdminPlayer, online: boolean): string {
  return `<tr>
    <td>${esc(p.name)}</td>
    <td>${esc(p.phone || '—')}</td>
    <td>${num(p.coins)} 🪙</td>
    <td><span class="tag ${p.role}">${t(p.role)}</span></td>
    ${online ? `<td class="a-actions">
      <button class="a-link" data-adjust="${p.id}">${t('adjust')}</button>
      <button class="a-link" data-role="${p.id}" data-next="${p.role === 'admin' ? 'player' : 'admin'}">
        ${p.role === 'admin' ? t('makePlayer') : t('makeAdmin')}</button>
    </td>` : ''}
  </tr>`;
}

function wireRowActions(host: HTMLElement, players: AdminPlayer[]): void {
  host.querySelectorAll<HTMLButtonElement>('[data-adjust]').forEach((b) =>
    b.addEventListener('click', () => openAdjust(players.find((p) => p.id === b.dataset.adjust)!)));
  host.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) =>
    b.addEventListener('click', async () => {
      await setRole(b.dataset.role!, b.dataset.next as AdminPlayer['role']);
      await render(mountHost);
    }));
}

function openAdjust(p: AdminPlayer): void {
  document.querySelector('.a-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'a-modal';
  m.innerHTML = `<div class="a-scrim"></div><div class="a-dialog">
    <h3>${t('adjustCoins')} — ${esc(p.name)}</h3>
    <div class="a-form"><label>${t('amount')}<input id="amt" type="number" placeholder="+100 / -50" /></label></div>
    <div class="a-dialog-actions">
      <button class="a-btn primary" id="apply">${t('apply')}</button>
      <button class="a-btn ghost" id="cancel">${t('cancel')}</button>
    </div></div>`;
  document.body.appendChild(m);
  m.querySelector('.a-scrim')!.addEventListener('click', () => m.remove());
  m.querySelector('#cancel')!.addEventListener('click', () => m.remove());
  m.querySelector('#apply')!.addEventListener('click', async () => {
    const delta = Number(m.querySelector<HTMLInputElement>('#amt')!.value);
    if (Number.isFinite(delta) && delta !== 0) await adjustCoins(p.id, delta);
    m.remove();
    await render(mountHost);
  });
}
