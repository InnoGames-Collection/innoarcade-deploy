// Admin draws view — tune each draw's prize/ticket cost/caps, settle closed
// draws, and reconcile winners + ETB-airtime fulfillment.
//
// Draw WINDOWS and their committed seeds are created automatically server-side
// (ensure_active_draws), so this view never creates a draw or touches the seed —
// it only edits operator fields and triggers settlement, preserving the
// commit-reveal guarantee.

import { getLang } from '../../i18n';
import {
  listDraws, saveDraw, settleDraws, listDrawWinners, fulfillDrawWinner,
  type AdminDraw, type AdminDrawWinner,
} from '../../platform/admin';
import { t, esc, num, etb } from '../ui';

let mountHost: HTMLElement;

const STATE_KEY: Record<string, 'live' | 'ended' | 'settled' | 'voidState'> = {
  open: 'live', drawing: 'ended', settled: 'settled', void: 'voidState',
};

export async function render(host: HTMLElement): Promise<void> {
  mountHost = host;
  host.innerHTML = `<div class="a-loading">…</div>`;
  const [draws, winners] = await Promise.all([listDraws(), listDrawWinners()]);

  host.innerHTML = `
    <div class="a-toolbar">
      <p class="a-hint">${t('drawsHint')}</p>
      <button class="a-btn primary" id="settle">↻ ${t('settleDraws')}</button>
    </div>

    <div class="a-card">
      <table class="a-table">
        <thead><tr>
          <th>${t('titleEn')}</th><th>${t('prizeEtb')}</th><th>${t('ticketCost')}</th>
          <th>${t('ticketCap')}</th><th>${t('entrants')}</th><th>${t('ticketsSold')}</th>
          <th>${t('state')}</th><th>${t('actions')}</th>
        </tr></thead>
        <tbody>
          ${draws.map((row) => {
            const st = STATE_KEY[row.state] ?? 'ended';
            return `<tr>
              <td>${esc(getLang() === 'am' ? row.titleAm : row.titleEn)}</td>
              <td>${etb(row.prizeEtb)}</td>
              <td>${num(row.ticketCostPoints)} ⭐</td>
              <td>${num(row.maxTicketsPerUser)}</td>
              <td>${num(row.entrants)}</td>
              <td>${num(row.totalTickets)}</td>
              <td><span class="state s-${st}">${t(st)}</span></td>
              <td class="a-actions"><button class="a-link" data-edit="${esc(row.id)}">${t('edit')}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <h3 class="a-subhead">${t('drawWinners')}</h3>
    <div class="a-card">
      <table class="a-table">
        <thead><tr>
          <th>${t('titleEn')}</th><th>${t('rank')}</th><th>${t('name')}</th><th>${t('phone')}</th>
          <th>${t('prizeEtb')}</th><th>${t('fulfillment')}</th><th>${t('actions')}</th>
        </tr></thead>
        <tbody>
          ${winners.length ? winners.map((w) => `<tr>
            <td>${esc(w.drawId)}</td>
            <td>${num(w.rank)}</td>
            <td>${esc(w.name)}</td>
            <td>${esc(w.phone)}</td>
            <td>${etb(w.prizeEtb)}</td>
            <td><span class="state s-${w.fulfillment === 'paid' ? 'settled' : w.fulfillment === 'failed' ? 'voidState' : 'ended'}">${fStatus(w.fulfillment)}</span></td>
            <td class="a-actions">
              ${w.fulfillment === 'pending' ? `
                <button class="a-link" data-paid="${esc(w.drawId)}" data-rank="${w.rank}">${t('markPaid')}</button>
                <button class="a-link warn" data-failed="${esc(w.drawId)}" data-rank="${w.rank}">${t('markFailed')}</button>` : '—'}
            </td>
          </tr>`).join('') : `<tr><td colspan="7" class="a-empty">—</td></tr>`}
        </tbody>
      </table>
    </div>`;

  host.querySelector('#settle')!.addEventListener('click', async () => {
    if (!confirm(t('settleDrawsConfirm'))) return;
    await settleDraws();
    await render(mountHost);
  });
  host.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openEditor(draws.find((x) => x.id === b.dataset.edit))));
  host.querySelectorAll<HTMLButtonElement>('[data-paid]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fulfillDrawWinner(b.dataset.paid!, Number(b.dataset.rank), 'paid');
      await render(mountHost);
    }));
  host.querySelectorAll<HTMLButtonElement>('[data-failed]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fulfillDrawWinner(b.dataset.failed!, Number(b.dataset.rank), 'failed');
      await render(mountHost);
    }));
}

const fStatus = (s: AdminDrawWinner['fulfillment']): string =>
  s === 'paid' ? t('paid_s') : s === 'failed' ? t('failed') : t('pending');

function modal(inner: string): HTMLElement {
  document.querySelector('.a-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'a-modal';
  m.innerHTML = `<div class="a-scrim"></div><div class="a-dialog">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.a-scrim')!.addEventListener('click', () => m.remove());
  return m;
}

function openEditor(existing?: AdminDraw): void {
  if (!existing) return;
  const m = modal(`
    <h3>${esc(getLang() === 'am' ? existing.titleAm : existing.titleEn)}</h3>
    <div class="a-form">
      <label>${t('titleEn')}<input id="ten" value="${esc(existing.titleEn)}" /></label>
      <label>${t('titleAm')}<input id="tam" value="${esc(existing.titleAm)}" /></label>
      <label>${t('prizeEtb')}<input id="prize" type="number" min="0" value="${existing.prizeEtb}" /></label>
      <label>${t('ticketCost')}<input id="cost" type="number" min="0" value="${existing.ticketCostPoints}" /></label>
      <label>${t('ticketCap')}<input id="cap" type="number" min="1" value="${existing.maxTicketsPerUser}" /></label>
      <label>${t('minTickets')}<input id="min" type="number" min="0" value="${existing.minTickets}" /></label>
      <label>${t('winnerCount')}<input id="wc" type="number" min="1" value="${existing.winnerCount}" /></label>
    </div>
    <div class="a-dialog-actions">
      <button class="a-btn primary" id="save">${t('save')}</button>
      <button class="a-btn ghost" id="cancel">${t('cancel')}</button>
    </div>`);

  const q = <T extends HTMLElement>(s: string) => m.querySelector<T>(s)!;
  q('#cancel').addEventListener('click', () => m.remove());
  q('#save').addEventListener('click', async () => {
    await saveDraw({
      id: existing.id,
      titleEn: q<HTMLInputElement>('#ten').value || existing.titleEn,
      titleAm: q<HTMLInputElement>('#tam').value || existing.titleAm,
      prizeEtb: Number(q<HTMLInputElement>('#prize').value) || 0,
      ticketCostPoints: Number(q<HTMLInputElement>('#cost').value) || 0,
      maxTicketsPerUser: Number(q<HTMLInputElement>('#cap').value) || 1,
      minTickets: Number(q<HTMLInputElement>('#min').value) || 0,
      winnerCount: Number(q<HTMLInputElement>('#wc').value) || 1,
    });
    m.remove();
    await render(mountHost);
  });
}
