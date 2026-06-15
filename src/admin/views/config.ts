// Admin config view — edit the coin-package catalogue, default entry fee, house
// rake, payment-method toggles and the maintenance flag. Persists via
// admin.saveConfig (admin-action Edge Function online, localStorage offline).

import { isConfigured } from '../../platform/supabase';
import { config, loadConfig, type CoinPackage } from '../../platform/config';
import { saveConfig } from '../../platform/admin';
import { t } from '../ui';

export async function render(host: HTMLElement): Promise<void> {
  await loadConfig();
  const c = config();

  const pkgRow = (p: CoinPackage, i: number) => `
    <tr data-i="${i}">
      <td><input class="p-coins" type="number" min="0" value="${p.coins}" /></td>
      <td><input class="p-bonus" type="number" min="0" value="${p.bonus}" /></td>
      <td><input class="p-price" type="number" min="0" value="${p.priceEtb}" /></td>
      <td><input class="p-pop" type="checkbox" ${p.popular ? 'checked' : ''} /></td>
      <td><button class="a-link warn p-rm">${t('remove')}</button></td>
    </tr>`;

  host.innerHTML = `
    <div class="a-card">
      <div class="a-card-head">${t('coinPackages')}</div>
      <table class="a-table">
        <thead><tr><th>${t('coins')}</th><th>${t('bonus')}</th><th>${t('price')}</th><th>★</th><th></th></tr></thead>
        <tbody id="pkgs">${c.coinPackages.map(pkgRow).join('')}</tbody>
      </table>
      <button class="a-btn ghost" id="addPkg">＋ ${t('addPackage')}</button>
    </div>

    <div class="a-card">
      <div class="a-form a-form-grid">
        <label>${t('defaultFee')}<input id="fee" type="number" min="0" value="${c.defaultEntryFeeCoins}" /></label>
        <label>${t('rake')}<input id="rake" type="number" min="0" max="40" value="${c.houseRakePct}" /></label>
      </div>
      <div class="a-toggles">
        <label class="a-toggle"><input id="m-tele" type="checkbox" ${c.paymentMethods.telebirr ? 'checked' : ''} /> ${t('telebirr')}</label>
        <label class="a-toggle"><input id="m-top" type="checkbox" ${c.paymentMethods.topup ? 'checked' : ''} /> ${t('topup')}</label>
        <label class="a-toggle warn"><input id="maint" type="checkbox" ${c.maintenance ? 'checked' : ''} /> ${t('maintenance')}</label>
      </div>
    </div>

    <div class="a-card">
      <div class="a-toggles">
        <label class="a-toggle warn"><input id="wr-on" type="checkbox" ${c.winRateOverride != null ? 'checked' : ''} /> ${t('forceWinRate')}</label>
      </div>
      <div class="a-form a-form-grid">
        <label>${t('winRatePct')}<input id="wr-pct" type="number" min="0" max="100" value="${c.winRateOverride ?? 100}" ${c.winRateOverride == null ? 'disabled' : ''} /></label>
      </div>
      <p class="a-note">${t('winRateHint')}</p>
    </div>

    <div class="a-toolbar">
      <button class="a-btn primary" id="save">${t('save')}</button>
      <span class="a-saved" id="saved"></span>
    </div>
    ${isConfigured() ? '' : `<p class="a-note">${t('offlineNote')}</p>`}`;

  const tbody = host.querySelector<HTMLElement>('#pkgs')!;
  host.querySelector('#addPkg')!.addEventListener('click', () => {
    const i = tbody.children.length;
    tbody.insertAdjacentHTML('beforeend', pkgRow({ id: `pkg${i}`, coins: 100, bonus: 0, priceEtb: 50 }, i));
    wireRemove();
  });
  wireRemove();

  function wireRemove(): void {
    tbody.querySelectorAll<HTMLButtonElement>('.p-rm').forEach((b) =>
      b.onclick = () => b.closest('tr')!.remove());
  }

  // Win-rate override: the % field is only live when the toggle is on.
  const wrOn = host.querySelector<HTMLInputElement>('#wr-on')!;
  const wrPct = host.querySelector<HTMLInputElement>('#wr-pct')!;
  wrOn.addEventListener('change', () => { wrPct.disabled = !wrOn.checked; });

  host.querySelector('#save')!.addEventListener('click', async () => {
    const packages: CoinPackage[] = [...tbody.querySelectorAll<HTMLElement>('tr')].map((tr, i) => ({
      id: `pkg_${i}`,
      coins: Number(tr.querySelector<HTMLInputElement>('.p-coins')!.value) || 0,
      bonus: Number(tr.querySelector<HTMLInputElement>('.p-bonus')!.value) || 0,
      priceEtb: Number(tr.querySelector<HTMLInputElement>('.p-price')!.value) || 0,
      popular: tr.querySelector<HTMLInputElement>('.p-pop')!.checked,
    }));
    await saveConfig({
      coinPackages: packages,
      defaultEntryFeeCoins: Number(host.querySelector<HTMLInputElement>('#fee')!.value) || 0,
      houseRakePct: Number(host.querySelector<HTMLInputElement>('#rake')!.value) || 0,
      paymentMethods: {
        telebirr: host.querySelector<HTMLInputElement>('#m-tele')!.checked,
        topup: host.querySelector<HTMLInputElement>('#m-top')!.checked,
      },
      maintenance: host.querySelector<HTMLInputElement>('#maint')!.checked,
      winRateOverride: wrOn.checked
        ? Math.min(100, Math.max(0, Number(wrPct.value) || 0))
        : null,
    });
    const saved = host.querySelector('#saved')!;
    saved.textContent = '✓ ' + t('saved');
    setTimeout(() => { saved.textContent = ''; }, 2000);
  });
}
