// Player dashboard panel on the hub: wallet balance, recent coin transactions,
// the player's tournament entries (with live rank and any prize won), and total
// prizes. Self-contained widget; renders into #playerDashboard. Inline EN/AM.

import { getLang } from '../i18n';
import { balance, ledger, type LedgerEntry } from '../platform/wallet';
import {
  myEntries, getTournament, playerStanding, tournamentState, type TournamentEntry,
} from '../platform/tournaments';

const STR = {
  en: {
    wallet: 'My wallet', balance: 'Balance', coins: 'coins', history: 'Recent activity',
    none: 'No activity yet.', myTours: 'My tournaments', noTours: 'You haven’t entered a tournament yet.',
    rank: 'Rank', prize: 'Prize', prizesWon: 'Prizes won', live: 'Live', ended: 'Ended',
    upcoming: 'Upcoming', settled: 'Settled',
    purchase: 'Coin purchase', entry_fee: 'Entry fee', prize_: 'Prize payout', admin_adjust: 'Adjustment',
  },
  am: {
    wallet: 'የእኔ ቦርሳ', balance: 'ቀሪ ሂሳብ', coins: 'ሳንቲሞች', history: 'የቅርብ እንቅስቃሴ',
    none: 'እስካሁን እንቅስቃሴ የለም።', myTours: 'የእኔ ውድድሮች', noTours: 'እስካሁን ውድድር አልገቡም።',
    rank: 'ደረጃ', prize: 'ሽልማት', prizesWon: 'የተሸለሙ', live: 'በቀጥታ', ended: 'አብቅቷል',
    upcoming: 'በቅርቡ', settled: 'ተወራርዷል',
    purchase: 'የሳንቲም ግዢ', entry_fee: 'የመግቢያ ክፍያ', prize_: 'የሽልማት ክፍያ', admin_adjust: 'ማስተካከያ',
  },
};
const t = (k: keyof typeof STR.en): string => (STR[getLang()] ?? STR.en)[k];
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function reasonLabel(reason: string): string {
  const map: Record<string, keyof typeof STR.en> = {
    purchase: 'purchase', entry_fee: 'entry_fee', prize: 'prize_', admin_adjust: 'admin_adjust',
  };
  return t(map[reason] ?? 'admin_adjust');
}

const stateLabel: Record<string, () => string> = {
  live: () => t('live'), ended: () => t('ended'), upcoming: () => t('upcoming'),
  settling: () => t('ended'), settled: () => t('settled'),
};

export async function renderDashboard(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#playerDashboard');
  if (!host) return;

  const [bal, rows, entries] = await Promise.all([balance(), ledger(8), myEntries()]);
  const prizesWon = entries.reduce((s, e) => s + e.prizeWon, 0);

  host.innerHTML = `
    <div class="pd-grid">
      <div class="pd-card pd-wallet">
        <div class="pd-label">${t('balance')}</div>
        <div class="pd-balance">🪙 ${bal.toLocaleString()}</div>
        <div class="pd-sub">${t('prizesWon')}: <strong>${prizesWon.toLocaleString()}</strong> 🪙</div>
      </div>
      <div class="pd-card pd-history">
        <div class="pd-card-head">${t('history')}</div>
        ${rows.length ? `<ul class="pd-ledger">${rows.map(ledgerRow).join('')}</ul>`
          : `<p class="pd-empty">${t('none')}</p>`}
      </div>
      <div class="pd-card pd-tours">
        <div class="pd-card-head">${t('myTours')}</div>
        ${entries.length ? `<ul class="pd-entries">${entries.map(entryRow).join('')}</ul>`
          : `<p class="pd-empty">${t('noTours')}</p>`}
      </div>
    </div>`;
}

function ledgerRow(e: LedgerEntry): string {
  const pos = e.delta >= 0;
  return `<li class="pd-lrow">
    <span class="pd-lreason">${esc(reasonLabel(e.reason))}</span>
    <span class="pd-ldelta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${e.delta.toLocaleString()} 🪙</span>
  </li>`;
}

function entryRow(e: TournamentEntry): string {
  const tour = getTournament(e.tournamentId);
  const title = tour ? (getLang() === 'am' ? tour.titleAm : tour.titleEn) : e.tournamentId;
  const st = tour ? tournamentState(tour) : 'ended';
  const me = playerStanding(e.tournamentId);
  return `<li class="pd-erow">
    <div class="pd-einfo">
      <span class="pd-etitle">${esc(title)}</span>
      <span class="pd-estate s-${st}">${stateLabel[st]()}</span>
    </div>
    <div class="pd-emeta">
      ${me ? `<span>${t('rank')} <strong>#${me.rank}</strong></span>` : ''}
      ${e.prizeWon ? `<span class="pd-eprize">+${e.prizeWon.toLocaleString()} 🪙</span>` : ''}
    </div>
  </li>`;
}

export function injectDashboardStyles(): void {
  if (document.getElementById('dashboard-styles')) return;
  const s = document.createElement('style');
  s.id = 'dashboard-styles';
  s.textContent = `
    .pd-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
    @media (max-width:780px){ .pd-grid{ grid-template-columns:1fr; } }
    .pd-card { background:var(--card,#fff); border:1px solid var(--line); border-radius:16px; padding:16px; }
    .pd-wallet { background:linear-gradient(160deg,#1b2a6b,#0a1130); color:#fff; border:none; }
    .pd-label { font-size:.78rem; opacity:.8; text-transform:uppercase; letter-spacing:.04em; }
    .pd-balance { font-size:2rem; font-weight:900; margin:.2rem 0; }
    .pd-sub { font-size:.82rem; opacity:.9; }
    .pd-card-head { font-weight:800; margin-bottom:10px; }
    .pd-ledger, .pd-entries { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
    .pd-lrow, .pd-erow { display:flex; justify-content:space-between; align-items:center; font-size:.88rem;
      padding-bottom:8px; border-bottom:1px solid var(--line); }
    .pd-lrow:last-child, .pd-erow:last-child { border-bottom:none; padding-bottom:0; }
    .pd-ldelta.pos { color:#1f9d55; font-weight:800; } .pd-ldelta.neg { color:#d64545; font-weight:800; }
    .pd-einfo { display:flex; flex-direction:column; gap:2px; }
    .pd-etitle { font-weight:700; }
    .pd-estate { font-size:.7rem; font-weight:800; padding:.05rem .45rem; border-radius:999px; width:max-content; }
    .pd-estate.s-live { background:#e6f7ee; color:#1f9d55; } .pd-estate.s-ended { background:#eef0f4; color:#6b7280; }
    .pd-estate.s-upcoming { background:#eef2ff; color:#4f63d2; } .pd-estate.s-settled { background:#fff3d6; color:#9a6b12; }
    .pd-emeta { display:flex; gap:10px; align-items:center; font-size:.85rem; }
    .pd-eprize { color:#1f9d55; font-weight:800; }
    .pd-empty { font-size:.85rem; color:var(--muted); margin:0; }`;
  document.head.appendChild(s);
}
