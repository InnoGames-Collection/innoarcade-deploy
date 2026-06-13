// Admin dashboard view — operational KPIs and a 7-day revenue chart.

import { metrics } from '../../platform/admin';
import { t, num, etb, barChart } from '../ui';

export async function render(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div class="a-loading">…</div>`;
  const m = await metrics();

  const kpi = (label: string, value: string, accent = false) => `
    <div class="kpi${accent ? ' accent' : ''}">
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;

  host.innerHTML = `
    <div class="kpi-grid">
      ${kpi(t('players'), num(m.players))}
      ${kpi(t('coinsSold'), num(m.coinsSold) + ' 🪙')}
      ${kpi(t('revenue'), etb(m.revenueEtb), true)}
      ${kpi(t('ggr'), etb(m.ggr))}
      ${kpi(t('liveTournaments'), num(m.liveTournaments))}
      ${kpi(t('pendingPayouts'), num(m.pendingPayouts))}
    </div>
    <div class="a-card">
      <div class="a-card-head">${t('revenue7d')}</div>
      ${barChart(m.revenueSeries)}
    </div>`;
}
