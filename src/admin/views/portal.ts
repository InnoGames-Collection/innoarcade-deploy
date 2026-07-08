// Admin portal view — edit hub promos, news, and curated game shelves.

import { config, loadConfig, type PortalPromo, type PortalNewsItem } from '../../platform/config';
import { saveConfig } from '../../platform/admin';
import { t } from '../ui';

function promoRow(p: PortalPromo, i: number): string {
  return `
    <tr data-i="${i}">
      <td><input class="p-img" type="text" value="${p.img.replace(/"/g, '&quot;')}" /></td>
      <td><input class="p-alt-en" type="text" value="${p.altEn.replace(/"/g, '&quot;')}" /></td>
      <td><input class="p-alt-am" type="text" value="${p.altAm.replace(/"/g, '&quot;')}" /></td>
      <td><input class="p-href" type="text" value="${(p.href ?? '').replace(/"/g, '&quot;')}" placeholder="#games" /></td>
      <td><button type="button" class="a-link warn p-rm">${t('remove')}</button></td>
    </tr>`;
}

function newsRow(n: PortalNewsItem, i: number): string {
  return `
    <tr data-i="${i}">
      <td><input class="n-icon" type="text" value="${n.icon}" maxlength="4" /></td>
      <td><input class="n-en" type="text" value="${n.textEn.replace(/"/g, '&quot;')}" /></td>
      <td><input class="n-am" type="text" value="${n.textAm.replace(/"/g, '&quot;')}" /></td>
      <td><input class="n-ago" type="text" value="${n.ago}" /></td>
      <td><button type="button" class="a-link warn n-rm">${t('remove')}</button></td>
    </tr>`;
}

export async function render(host: HTMLElement): Promise<void> {
  await loadConfig();
  const c = config();
  const portal = c.portal ?? {};
  const promos = portal.promos ?? [];
  const news = portal.news ?? [];
  const trending = (portal.trendingGameIds ?? []).join(', ');
  const recent = (portal.recentlyAddedGameIds ?? []).join(', ');
  const reward = portal.dailyChallenge?.rewardCoins ?? 200;

  host.innerHTML = `
    <div class="a-card">
      <div class="a-card-head">Hub promos (carousel)</div>
      <table class="a-table">
        <thead><tr><th>Image URL</th><th>Alt EN</th><th>Alt AM</th><th>Link</th><th></th></tr></thead>
        <tbody id="promos">${promos.map(promoRow).join('')}</tbody>
      </table>
      <button type="button" class="a-btn ghost" id="addPromo">＋ Add promo</button>
    </div>

    <div class="a-card">
      <div class="a-card-head">News feed</div>
      <table class="a-table">
        <thead><tr><th>Icon</th><th>Text EN</th><th>Text AM</th><th>Ago</th><th></th></tr></thead>
        <tbody id="news">${news.map(newsRow).join('')}</tbody>
      </table>
      <button type="button" class="a-btn ghost" id="addNews">＋ Add news item</button>
    </div>

    <div class="a-card">
      <div class="a-form a-form-grid">
        <label>Trending game IDs (comma-separated)
          <input id="trending" type="text" value="${trending}" placeholder="temple-dash, fruit-slice" />
        </label>
        <label>Recently added IDs
          <input id="recent" type="text" value="${recent}" />
        </label>
        <label>Daily challenge reward (coins)
          <input id="reward" type="number" min="0" value="${reward}" />
        </label>
      </div>
      <p class="a-note">Game IDs must match catalog.ts entries. Changes appear on hub reload.</p>
    </div>

    <div class="a-toolbar">
      <button type="button" class="a-btn primary" id="save">${t('save')}</button>
      <span class="a-saved" id="saved"></span>
    </div>`;

  const promoBody = host.querySelector<HTMLElement>('#promos')!;
  const newsBody = host.querySelector<HTMLElement>('#news')!;

  host.querySelector('#addPromo')!.addEventListener('click', () => {
    const i = promoBody.children.length;
    promoBody.insertAdjacentHTML('beforeend', promoRow({
      img: '/brand/ad-banner-1.png', altEn: 'Promo', altAm: 'Promo', href: '#games',
    }, i));
    wireRemove();
  });
  host.querySelector('#addNews')!.addEventListener('click', () => {
    const i = newsBody.children.length;
    newsBody.insertAdjacentHTML('beforeend', newsRow({
      icon: '📢', textEn: 'Announcement', textAm: 'Announcement', ago: '1h',
    }, i));
    wireRemove();
  });

  function wireRemove(): void {
    promoBody.querySelectorAll<HTMLButtonElement>('.p-rm').forEach((b) => {
      b.onclick = () => b.closest('tr')!.remove();
    });
    newsBody.querySelectorAll<HTMLButtonElement>('.n-rm').forEach((b) => {
      b.onclick = () => b.closest('tr')!.remove();
    });
  }
  wireRemove();

  host.querySelector('#save')!.addEventListener('click', async () => {
    const readPromos = (): PortalPromo[] => [...promoBody.querySelectorAll<HTMLElement>('tr')].map((tr) => ({
      img: (tr.querySelector<HTMLInputElement>('.p-img')!).value.trim(),
      altEn: (tr.querySelector<HTMLInputElement>('.p-alt-en')!).value.trim(),
      altAm: (tr.querySelector<HTMLInputElement>('.p-alt-am')!).value.trim(),
      href: (tr.querySelector<HTMLInputElement>('.p-href')!).value.trim() || undefined,
    })).filter((p) => p.img);

    const readNews = (): PortalNewsItem[] => [...newsBody.querySelectorAll<HTMLElement>('tr')].map((tr) => ({
      icon: (tr.querySelector<HTMLInputElement>('.n-icon')!).value.trim() || '📢',
      textEn: (tr.querySelector<HTMLInputElement>('.n-en')!).value.trim(),
      textAm: (tr.querySelector<HTMLInputElement>('.n-am')!).value.trim(),
      ago: (tr.querySelector<HTMLInputElement>('.n-ago')!).value.trim() || '1h',
    })).filter((n) => n.textEn);

    const splitIds = (raw: string): string[] =>
      raw.split(',').map((s) => s.trim()).filter(Boolean);

    const portalNext = {
      promos: readPromos(),
      news: readNews(),
      trendingGameIds: splitIds((host.querySelector<HTMLInputElement>('#trending')!).value),
      recentlyAddedGameIds: splitIds((host.querySelector<HTMLInputElement>('#recent')!).value),
      dailyChallenge: {
        rewardCoins: Number((host.querySelector<HTMLInputElement>('#reward')!).value) || 200,
      },
    };

    await saveConfig({ portal: portalNext });
    const saved = host.querySelector('#saved');
    if (saved) saved.textContent = t('saved');
    setTimeout(() => { if (saved) saved.textContent = ''; }, 2000);
  });
}
