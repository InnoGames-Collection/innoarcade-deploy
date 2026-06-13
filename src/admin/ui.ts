// Shared admin-console helpers: bilingual strings (EN/AM, inline like the rest
// of the hub widgets), HTML escaping, currency/number formatting, and a tiny
// dependency-free inline-SVG bar chart — keeping the zero-runtime-dependency
// ethos of the platform.

import { getLang } from '../i18n';

const STR = {
  en: {
    title: 'InnoArcade Admin', console: 'Operator console',
    nav_dashboard: 'Dashboard', nav_tournaments: 'Tournaments', nav_players: 'Players',
    nav_payments: 'Payments', nav_config: 'Config',
    signIn: 'Sign in', signOut: 'Sign out', notAuthorised: 'You are not authorised to view this console.',
    signInPrompt: 'Sign in with an admin account to continue.',
    // metrics
    players: 'Players', coinsSold: 'Coins sold', revenue: 'Revenue', ggr: 'House revenue (GGR)',
    liveTournaments: 'Live tournaments', pendingPayouts: 'Pending payouts', revenue7d: 'Revenue — last 7 days',
    // tournaments
    game: 'Game', type: 'Type', entryFee: 'Entry fee', prizeModel: 'Prize', pool: 'Pool', state: 'State',
    actions: 'Actions', settle: 'Settle', edit: 'Edit', createTour: 'Create tournament', save: 'Save',
    cancel: 'Cancel', free: 'Free', paid: 'Paid', sponsored: 'Sponsored', poolModel: 'Pooled',
    titleEn: 'Title (EN)', titleAm: 'Title (AM)', sponsoredPrize: 'Sponsored prize', settled: 'Settled',
    settleConfirm: 'Settle this tournament and pay out prizes?', live: 'Live', upcoming: 'Upcoming', ended: 'Ended',
    // players
    search: 'Search players…', name: 'Name', phone: 'Phone', coins: 'Coins', role: 'Role',
    adjust: 'Adjust', makeAdmin: 'Make admin', makePlayer: 'Make player', adjustCoins: 'Adjust coins',
    amount: 'Amount', apply: 'Apply', admin: 'admin', player: 'player',
    // payments
    order: 'Order', method: 'Method', status: 'Status', date: 'Date', all: 'All',
    paid_s: 'Paid', pending: 'Pending', failed: 'Failed',
    // config
    coinPackages: 'Coin packages', defaultFee: 'Default entry fee (coins)', rake: 'House rake (%)',
    paymentMethods: 'Payment methods', maintenance: 'Maintenance mode', telebirr: 'TeleBirr',
    topup: 'Airtime top-up', price: 'Price (ETB)', bonus: 'Bonus', addPackage: 'Add package', remove: 'Remove',
    saved: 'Saved', offlineNote: 'Demo mode — changes are local to this browser.',
  },
  am: {
    title: 'ኢኖአርኬድ አስተዳዳሪ', console: 'የአስተዳዳሪ ኮንሶል',
    nav_dashboard: 'ዳሽቦርድ', nav_tournaments: 'ውድድሮች', nav_players: 'ተጫዋቾች',
    nav_payments: 'ክፍያዎች', nav_config: 'ቅንብር',
    signIn: 'ግባ', signOut: 'ውጣ', notAuthorised: 'ይህን ኮንሶል ለማየት ፈቃድ የለዎትም።',
    signInPrompt: 'ለመቀጠል በአስተዳዳሪ መለያ ይግቡ።',
    players: 'ተጫዋቾች', coinsSold: 'የተሸጡ ሳንቲሞች', revenue: 'ገቢ', ggr: 'የቤት ገቢ',
    liveTournaments: 'ቀጥታ ውድድሮች', pendingPayouts: 'በመጠባበቅ ላይ ክፍያዎች', revenue7d: 'ገቢ — ያለፉት 7 ቀናት',
    game: 'ጨዋታ', type: 'አይነት', entryFee: 'የመግቢያ ክፍያ', prizeModel: 'ሽልማት', pool: 'ገንዘብ', state: 'ሁኔታ',
    actions: 'እርምጃዎች', settle: 'አወራርድ', edit: 'አስተካክል', createTour: 'ውድድር ፍጠር', save: 'አስቀምጥ',
    cancel: 'ይቅር', free: 'ነፃ', paid: 'የሚከፈል', sponsored: 'ስፖንሰር', poolModel: 'የተጠራቀመ',
    titleEn: 'ርዕስ (እንግሊዝ)', titleAm: 'ርዕስ (አማርኛ)', sponsoredPrize: 'የስፖንሰር ሽልማት', settled: 'ተወራርዷል',
    settleConfirm: 'ይህን ውድድር አወራርደው ሽልማቶችን ይክፈሉ?', live: 'ቀጥታ', upcoming: 'በቅርቡ', ended: 'አብቅቷል',
    search: 'ተጫዋቾችን ይፈልጉ…', name: 'ስም', phone: 'ስልክ', coins: 'ሳንቲሞች', role: 'ሚና',
    adjust: 'አስተካክል', makeAdmin: 'አስተዳዳሪ አድርግ', makePlayer: 'ተጫዋች አድርግ', adjustCoins: 'ሳንቲም አስተካክል',
    amount: 'መጠን', apply: 'ተግብር', admin: 'አስተዳዳሪ', player: 'ተጫዋች',
    order: 'ትዕዛዝ', method: 'ዘዴ', status: 'ሁኔታ', date: 'ቀን', all: 'ሁሉም',
    paid_s: 'ተከፍሏል', pending: 'በመጠባበቅ', failed: 'አልተሳካም',
    coinPackages: 'የሳንቲም ጥቅሎች', defaultFee: 'ነባሪ የመግቢያ ክፍያ (ሳንቲም)', rake: 'የቤት ድርሻ (%)',
    paymentMethods: 'የክፍያ ዘዴዎች', maintenance: 'የጥገና ሁነታ', telebirr: 'ቴሌብር',
    topup: 'የአየር ሰዓት', price: 'ዋጋ (ETB)', bonus: 'ጉርሻ', addPackage: 'ጥቅል ጨምር', remove: 'አስወግድ',
    saved: 'ተቀምጧል', offlineNote: 'የማሳያ ሁነታ — ለውጦች በዚህ አሳሽ ብቻ ናቸው።',
  },
};

export type AdminKey = keyof typeof STR.en;
export const t = (k: AdminKey): string => (STR[getLang()] ?? STR.en)[k];

export const esc = (s: string): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const num = (n: number): string => n.toLocaleString();
export const etb = (n: number): string => `${n.toLocaleString()} ETB`;

// A minimal inline-SVG bar chart. Returns an <svg> string scaled to the data.
export function barChart(values: number[], color = '#5b6cff'): string {
  if (!values.length) return '';
  const w = 320, h = 120, pad = 8;
  const max = Math.max(1, ...values);
  const bw = (w - pad * 2) / values.length;
  const bars = values.map((v, i) => {
    const bh = Math.round(((h - pad * 2) * v) / max);
    const x = pad + i * bw + bw * 0.15;
    const y = h - pad - bh;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${(bw * 0.7).toFixed(1)}" height="${bh}" rx="3" fill="${color}"></rect>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="bar-chart" preserveAspectRatio="none">${bars}</svg>`;
}

export const dateShort = (ms: number): string =>
  new Date(ms).toLocaleDateString(getLang() === 'am' ? 'am-ET' : 'en-GB', { month: 'short', day: 'numeric' });
