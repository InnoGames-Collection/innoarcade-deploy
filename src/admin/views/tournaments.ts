// Admin tournaments view — list every tournament with its economy + state, edit
// the config (type, entry fee, prize model), settle finished events, and create
// new custom tournaments.

import { getLang } from '../../i18n';
import { CATALOG } from '../../platform/catalog';
import {
  newCustomTournamentId, cadenceOf, type Tournament, type PrizeTier,
} from '../../platform/tournaments';
import { listTournaments, saveTournament, settleTournament, type AdminTournament } from '../../platform/admin';
import { t, esc, num } from '../ui';

const DEFAULT_TIERS: PrizeTier[] = [{ rank: 1, pct: 50 }, { rank: 2, pct: 30 }, { rank: 3, pct: 20 }];
const STATE_KEY: Record<string, 'live' | 'upcoming' | 'ended' | 'settled'> = {
  live: 'live', upcoming: 'upcoming', ended: 'ended', settling: 'ended', settled: 'settled',
};

let mountHost: HTMLElement;

export async function render(host: HTMLElement): Promise<void> {
  mountHost = host;
  host.innerHTML = `<div class="a-loading">…</div>`;
  const list = await listTournaments();
  const gname = (id: string): string => {
    const g = CATALOG.find((x) => x.id === id);
    return g ? (getLang() === 'am' ? g.nameAm : g.nameEn) : id;
  };

  host.innerHTML = `
    <div class="a-toolbar">
      <button class="a-btn primary" id="create">＋ ${t('createTour')}</button>
    </div>
    <div class="a-card">
      <table class="a-table">
        <thead><tr>
          <th>${t('titleEn')}</th><th>${t('game')}</th><th>${t('type')}</th>
          <th>${t('entryFee')}</th><th>${t('pool')}</th><th>${t('state')}</th><th>${t('actions')}</th>
        </tr></thead>
        <tbody>
          ${list.map((row) => {
            const st = STATE_KEY[row.state] ?? 'ended';
            return `<tr>
              <td>${esc(getLang() === 'am' ? row.titleAm : row.titleEn)}</td>
              <td>${esc(gname(row.gameId))}</td>
              <td><span class="tag ${row.type}">${row.type === 'paid' ? t('paid') : t('free')}</span></td>
              <td>${row.type === 'paid' ? num(row.entryFeeCoins) + ' 🪙' : '—'}</td>
              <td>${num(row.pool)} 🪙</td>
              <td><span class="state s-${st}">${t(st)}</span></td>
              <td class="a-actions">
                <button class="a-link" data-edit="${row.id}">${t('edit')}</button>
                ${row.state === 'ended' ? `<button class="a-link warn" data-settle="${row.id}">${t('settle')}</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  host.querySelector('#create')!.addEventListener('click', () => openEditor());
  host.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openEditor(list.find((x) => x.id === b.dataset.edit))));
  host.querySelectorAll<HTMLButtonElement>('[data-settle]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm(t('settleConfirm'))) return;
      await settleTournament(b.dataset.settle!);
      await render(mountHost);
    }));
}

function modal(inner: string): HTMLElement {
  document.querySelector('.a-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'a-modal';
  m.innerHTML = `<div class="a-scrim"></div><div class="a-dialog">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.a-scrim')!.addEventListener('click', () => m.remove());
  return m;
}

function openEditor(existing?: AdminTournament): void {
  const isNew = !existing;
  const games = CATALOG;
  const toLocal = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const m = modal(`
    <h3>${isNew ? t('createTour') : t('edit')}</h3>
    <div class="a-form">
      ${isNew ? `<label>${t('game')}<select id="game">${games.map((g) =>
        `<option value="${g.id}">${esc(getLang() === 'am' ? g.nameAm : g.nameEn)}</option>`).join('')}</select></label>` : ''}
      <label>${t('titleEn')}<input id="ten" value="${esc(existing?.titleEn ?? '')}" /></label>
      <label>${t('titleAm')}<input id="tam" value="${esc(existing?.titleAm ?? '')}" /></label>
      <label>${t('type')}<select id="type">
        <option value="free"${existing?.type === 'free' ? ' selected' : ''}>${t('free')}</option>
        <option value="paid"${existing?.type === 'paid' ? ' selected' : ''}>${t('paid')}</option>
      </select></label>
      <label id="feeWrap">${t('entryFee')}<input id="fee" type="number" min="0" value="${existing?.entryFeeCoins ?? 50}" /></label>
      <label>${t('prizeModel')}<select id="pmodel">
        <option value="sponsored"${existing?.prizeModel === 'sponsored' ? ' selected' : ''}>${t('sponsored')}</option>
        <option value="pool"${existing?.prizeModel === 'pool' ? ' selected' : ''}>${t('poolModel')}</option>
      </select></label>
      <label id="spWrap">${t('sponsoredPrize')}<input id="sp" type="number" min="0" value="${existing?.sponsoredPrize ?? 1000}" /></label>
      ${isNew ? `
        <label>Start<input id="start" type="datetime-local" value="${toLocal(Date.now())}" /></label>
        <label>End<input id="end" type="datetime-local" value="${toLocal(Date.now() + 7 * 864e5)}" /></label>` : ''}
    </div>
    <div class="a-dialog-actions">
      <button class="a-btn primary" id="save">${t('save')}</button>
      <button class="a-btn ghost" id="cancel">${t('cancel')}</button>
    </div>`);

  const q = <T extends HTMLElement>(s: string) => m.querySelector<T>(s)!;
  const syncVis = () => {
    q('#feeWrap').style.display = (q<HTMLSelectElement>('#type').value === 'paid') ? '' : 'none';
    q('#spWrap').style.display = (q<HTMLSelectElement>('#pmodel').value === 'sponsored') ? '' : 'none';
  };
  q('#type').addEventListener('change', syncVis);
  q('#pmodel').addEventListener('change', syncVis);
  syncVis();

  q('#cancel').addEventListener('click', () => m.remove());
  q('#save').addEventListener('click', async () => {
    const gameId = isNew ? q<HTMLSelectElement>('#game').value : existing!.gameId;
    const type = q<HTMLSelectElement>('#type').value as Tournament['type'];
    const t2: Tournament = {
      id: existing?.id ?? newCustomTournamentId(gameId),
      gameId,
      titleEn: q<HTMLInputElement>('#ten').value || 'Tournament',
      titleAm: q<HTMLInputElement>('#tam').value || 'ውድድር',
      type,
      entryFeeCoins: type === 'paid' ? Number(q<HTMLInputElement>('#fee').value) || 0 : 0,
      prizeModel: q<HTMLSelectElement>('#pmodel').value as Tournament['prizeModel'],
      sponsoredPrize: Number(q<HTMLInputElement>('#sp').value) || 0,
      prizeTiers: existing?.prizeTiers ?? DEFAULT_TIERS,
      prizeCoins: 0,
      cadence: existing?.cadence ?? cadenceOf(existing?.id ?? gameId),
      attempts: existing?.attempts ?? 1,
      requiredLevel: existing?.requiredLevel ?? 1,
      startsAt: isNew ? new Date(q<HTMLInputElement>('#start').value).getTime() : existing!.startsAt,
      endsAt: isNew ? new Date(q<HTMLInputElement>('#end').value).getTime() : existing!.endsAt,
    };
    await saveTournament(t2);
    m.remove();
    await render(mountHost);
  });
}
