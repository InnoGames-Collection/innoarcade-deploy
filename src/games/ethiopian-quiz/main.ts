// Ethiopian Quiz — a knowledge/trivia game built for GoPlay (tournament mode).
//
// A round is 5 random multiple-choice questions about Ethiopia (EN + AM). The
// score is the number answered correctly × 20 (so a perfect round = 100); a
// "win" (≥ 3 correct) mints the configured points. Economy + leaderboard run
// through the shared GameHost exactly like the ported chance games, so flipping
// the catalog mode to 'free' removes the entry fee / leaderboard with no edit
// here. Outcomes are decided locally — there is no server "is_correct" hook.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';

const host = createHost('ethiopian-quiz');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

interface Q { en: string; am: string; opts: [string, string][]; answer: number }

// [English, Amharic] option pairs; `answer` is the correct option index.
const BANK: Q[] = [
  { en: 'What is the capital city of Ethiopia?', am: 'የኢትዮጵያ ዋና ከተማ ማን ናት?',
    opts: [['Addis Ababa', 'አዲስ አበባ'], ['Adama', 'አዳማ'], ['Bahir Dar', 'ባህር ዳር'], ['Mekelle', 'መቀለ']], answer: 0 },
  { en: 'Which river is known as the source of the Blue Nile?', am: 'የጥቁር ዓባይ ምንጭ የሚባለው የትኛው ነው?',
    opts: [['Lake Tana', 'ጣና ሐይቅ'], ['Lake Abaya', 'አባያ ሐይቅ'], ['Awash', 'አዋሽ'], ['Omo', 'ኦሞ']], answer: 0 },
  { en: 'How many days are in the Ethiopian month of Pagumē?', am: 'ጳጉሜ ስንት ቀናት አሉት?',
    opts: [['5 or 6', '5 ወይም 6'], ['7', '7'], ['10', '10'], ['30', '30']], answer: 0 },
  { en: 'Which Ethiopian runner is famous for winning a marathon barefoot?', am: 'ባዶ እግሩን ማራቶን በማሸነፍ የሚታወቀው ኢትዮጵያዊ ሯጭ ማን ነው?',
    opts: [['Abebe Bikila', 'አበበ ቢቂላ'], ['Haile Gebrselassie', 'ኃይሌ ገብረሥላሴ'], ['Kenenisa Bekele', 'ቀነኒሳ በቀለ'], ['Derartu Tulu', 'ደራርቱ ቱሉ']], answer: 0 },
  { en: 'What is the staple flatbread of Ethiopian cuisine?', am: 'የኢትዮጵያ ምግብ ዋና ዳቦ ምንድን ነው?',
    opts: [['Injera', 'እንጀራ'], ['Dabo', 'ዳቦ'], ['Kita', 'ቂጣ'], ['Ambasha', 'አምባሻ']], answer: 0 },
  { en: 'How many official working languages of the federal government does Ethiopia use as primary?', am: 'የኢትዮጵያ ፌዴራል መንግሥት ዋና የሥራ ቋንቋ የትኛው ነው?',
    opts: [['Amharic', 'አማርኛ'], ['Oromiffa', 'ኦሮሚኛ'], ['Tigrinya', 'ትግርኛ'], ['English', 'እንግሊዝኛ']], answer: 0 },
  { en: 'Which ancient city is home to the famous rock-hewn churches?', am: 'ታዋቂዎቹ ከአለት የተፈለፈሉ አብያተ ክርስቲያናት የት ይገኛሉ?',
    opts: [['Lalibela', 'ላሊበላ'], ['Axum', 'አክሱም'], ['Gondar', 'ጎንደር'], ['Harar', 'ሐረር']], answer: 0 },
  { en: 'What is the name of Ethiopia’s currency?', am: 'የኢትዮጵያ ገንዘብ ስም ምንድን ነው?',
    opts: [['Birr', 'ብር'], ['Shilling', 'ሺሊንግ'], ['Nakfa', 'ናቕፋ'], ['Dinar', 'ዲናር']], answer: 0 },
  { en: 'Coffee is believed to have originated in which Ethiopian region?', am: 'ቡና የመነጨው ከየትኛው የኢትዮጵያ አካባቢ ነው ተብሎ ይታመናል?',
    opts: [['Kaffa', 'ካፋ'], ['Wollo', 'ወሎ'], ['Sidama', 'ሲዳማ'], ['Gojjam', 'ጎጃም']], answer: 0 },
  { en: 'Which empire/queen is linked to Ethiopia in ancient tradition?', am: 'በጥንታዊ ወግ ከኢትዮጵያ ጋር የሚገናኘው ንግሥት ማን ናት?',
    opts: [['Queen of Sheba', 'ንግሥተ ሳባ'], ['Cleopatra', 'ክሊዮፓትራ'], ['Nefertiti', 'ኔፈርቲቲ'], ['Boudica', 'ቡዲካ']], answer: 0 },
];

const STR = {
  en: { title: 'Ethiopian Quiz', start: 'Start', next: 'Next', again: 'Play again',
    correct: 'Correct! 🎉', wrong: 'Not quite.', q: 'Question', result: 'You scored',
    of: 'of', needCoins: 'Not enough coins — tap “All games” to top up.', signIn: 'Sign in from “All games” to compete.' },
  am: { title: 'የኢትዮጵያ ጥያቄ', start: 'ጀምር', next: 'ቀጣይ', again: 'እንደገና ይጫወቱ',
    correct: 'ትክክል! 🎉', wrong: 'አልተሳካም።', q: 'ጥያቄ', result: 'ያስመዘገቡት',
    of: 'ከ', needCoins: 'በቂ ሳንቲም የለም — ለመሙላት “ሁሉም ጨዋታዎች” ይጫኑ።', signIn: 'ለመወዳደር ከ“ሁሉም ጨዋታዎች” ይግቡ።' },
};
const lang = (): 'en' | 'am' => (getLang() === 'am' ? 'am' : 'en');
const s = (k: keyof typeof STR.en): string => STR[lang()][k];

const ROUND = 5;
let round: Q[] = [];
let idx = 0;
let correct = 0;
let locked = false;

const elQ = $('#eq-question');
const elOpts = $('#eq-options');
const elMsg = $('#eq-message');
const elProg = $('#eq-progress');
const startBtn = $('#eq-start') as HTMLButtonElement;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function setHUD(): void {
  $('#eq-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : '🆓';
  $('#eq-win').textContent = `+${host.winPoints}`;
  for (const id of ['eq-title', 'eq-title2']) $(`#${id}`).textContent = s('title');
}

function renderTournament(): void {
  const strip = $('#eq-tourney');
  if (!host.isTournament || !host.tournament) { strip.style.display = 'none'; return; }
  const title = getLang() === 'am' ? host.tournament.titleAm : host.tournament.titleEn;
  $('#eq-t-name').textContent = `${title}`;
  const standing = host.standing();
  $('#eq-rank').textContent = standing ? `#${standing.rank}` : '#—';
}

async function startRound(): Promise<void> {
  const begin = await host.begin();
  if (!begin.ok) {
    elMsg.textContent = begin.reason === 'auth' ? s('signIn') : s('needCoins');
    return;
  }
  setHUD();
  round = shuffle(BANK).slice(0, ROUND);
  idx = 0; correct = 0; locked = false;
  startBtn.style.display = 'none';
  showQuestion();
}

function showQuestion(): void {
  locked = false;
  elMsg.textContent = '';
  const q = round[idx];
  elProg.textContent = `${s('q')} ${idx + 1} / ${round.length}`;
  elQ.textContent = lang() === 'am' ? q.am : q.en;
  // present options in shuffled order, remembering which is correct
  const order = shuffle(q.opts.map((_, i) => i));
  elOpts.innerHTML = order.map((oi) =>
    `<button class="eq-opt" data-i="${oi}">${lang() === 'am' ? q.opts[oi][1] : q.opts[oi][0]}</button>`).join('');
  elOpts.querySelectorAll<HTMLButtonElement>('.eq-opt').forEach((b) =>
    b.addEventListener('click', () => answer(Number(b.dataset.i), b)));
}

function answer(choice: number, btn: HTMLButtonElement): void {
  if (locked) return;
  locked = true;
  const q = round[idx];
  const right = choice === q.answer;
  if (right) { correct++; btn.classList.add('ok'); sfx.coin(); }
  else {
    btn.classList.add('bad'); sfx.click();
    const correctBtn = elOpts.querySelector<HTMLButtonElement>(`.eq-opt[data-i="${q.answer}"]`);
    correctBtn?.classList.add('ok');
  }
  elMsg.textContent = right ? s('correct') : s('wrong');
  setTimeout(() => {
    idx++;
    if (idx < round.length) showQuestion();
    else finishRound();
  }, 1100);
}

function finishRound(): void {
  const score = correct * 20;
  const isWin = correct >= 3;
  elProg.textContent = '';
  elQ.textContent = `${s('result')} ${correct} ${s('of')} ${round.length}`;
  elOpts.innerHTML = '';
  elMsg.textContent = isWin ? `🎉 +${host.winPoints} ⭐` : '';
  startBtn.textContent = s('again');
  startBtn.style.display = '';
  void host.finish(score, isWin).then((res) => {
      if (host.isTournament && res.rank) $('#eq-rank').textContent = `#${res.rank}`;
    });
}

function applyLang(): void {
  applyTranslations();
  setHUD();
  renderTournament();
  startBtn.textContent = s('start');
}

function pick(l: Lang): void { setLang(l); document.documentElement.lang = l; applyLang(); syncLang(); }
function syncLang(): void {
  $('#langEn').classList.toggle('active', getLang() === 'en');
  $('#langAm').classList.toggle('active', getLang() === 'am');
}

$('#langEn').addEventListener('click', () => pick('en'));
$('#langAm').addEventListener('click', () => pick('am'));
startBtn.addEventListener('click', () => { void startRound(); });

applyLang();
syncLang();
