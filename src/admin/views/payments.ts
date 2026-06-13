// Admin payments view — the coin-purchase order book with a status filter.

import { listOrders } from '../../platform/admin';
import { PAY_METHOD_LABEL, type Order, type OrderStatus } from '../../platform/payments';
import { getLang } from '../../i18n';
import { t, esc, num, etb, dateShort } from '../ui';

let mountHost: HTMLElement;
let filter: OrderStatus | 'all' = 'all';

const STATUS_LABEL: Record<OrderStatus, () => string> = {
  paid: () => t('paid_s'), pending: () => t('pending'), failed: () => t('failed'), expired: () => t('failed'),
};

export async function render(host: HTMLElement): Promise<void> {
  mountHost = host;
  const orders = await listOrders(200);
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const chip = (f: OrderStatus | 'all', label: string) =>
    `<button class="a-chip${filter === f ? ' on' : ''}" data-f="${f}">${label}</button>`;

  host.innerHTML = `
    <div class="a-toolbar">
      ${chip('all', t('all'))}${chip('paid', t('paid_s'))}${chip('pending', t('pending'))}${chip('failed', t('failed'))}
    </div>
    <div class="a-card">
      <table class="a-table">
        <thead><tr>
          <th>${t('order')}</th><th>${t('coins')}</th><th>${t('amount')}</th>
          <th>${t('method')}</th><th>${t('status')}</th><th>${t('date')}</th>
        </tr></thead>
        <tbody>${shown.map(row).join('')}</tbody>
      </table>
    </div>`;

  host.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) =>
    b.addEventListener('click', () => { filter = b.dataset.f as typeof filter; void render(mountHost); }));
}

function row(o: Order): string {
  const ml = PAY_METHOD_LABEL[o.method];
  return `<tr>
    <td class="mono">${esc(o.id.slice(0, 10))}</td>
    <td>${num(o.coins)} 🪙</td>
    <td>${etb(o.amountEtb)}</td>
    <td>${ml.icon} ${getLang() === 'am' ? ml.am : ml.en}</td>
    <td><span class="state pay-${o.status}">${STATUS_LABEL[o.status]?.() ?? o.status}</span></td>
    <td>${dateShort(o.createdAt)}</td>
  </tr>`;
}
