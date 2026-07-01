// Ethiopian Quiz — free game with hub shell (menu / pause / game-over).

import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import {
  ensureToast,
  renderFreeMenuHtml,
  renderRunRewardHtml,
  startFreeRound,
  submitFreeRun,
} from '../../platform/freeGameShell';
import { promptIfSessionExpired } from '../../platform/sessionAuth';
import { isConfigured } from '../../platform/supabase';

const GAME_ID = 'ethiopian-quiz';
const host = createHost(GAME_ID);
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

type Phase = 'menu' | 'playing' | 'paused' | 'over';

interface Q { en: string; am: string; opts: [string, string][]; answer: number; d: 1 | 2 | 3 }

const BANK: Q[] = [
  { en: 'What is the capital city of Ethiopia?', am: 'የኢትዮጵያ ዋና ከተማ ማን ናት?',
    opts: [['Addis Ababa', 'አዲስ አበባ'], ['Adama', 'አዳማ'], ['Bahir Dar', 'ባህር ዳር'], ['Mekelle', 'መቀለ']], answer: 0, d: 1 },
  { en: 'Which river is known as the source of the Blue Nile?', am: 'የጥቁር ዓባይ ምንጭ የሚባለው የትኛው ነው?',
    opts: [['Lake Tana', 'ጣና ሐይቅ'], ['Lake Abaya', 'አባያ ሐይቅ'], ['Awash', 'አዋሽ'], ['Omo', 'ኦሞ']], answer: 0, d: 1 },
  { en: 'How many days are in the Ethiopian month of Pagumē?', am: 'ጳጉሜ ስንት ቀናት አሉት?',
    opts: [['5 or 6', '5 ወይም 6'], ['7', '7'], ['10', '10'], ['30', '30']], answer: 0, d: 1 },
  { en: 'Which Ethiopian runner is famous for winning a marathon barefoot?', am: 'ባዶ እግሩን ማራቶን በማሸነፍ የሚታወቀው ኢትዮጵያዊ ሯጭ ማን ነው?',
    opts: [['Abebe Bikila', 'አበበ ቢቂላ'], ['Haile Gebrselassie', 'ኃይሌ ገብረሥላሴ'], ['Kenenisa Bekele', 'ቀነኒሳ በቀለ'], ['Derartu Tulu', 'ደራርቱ ቱሉ']], answer: 0, d: 1 },
  { en: 'What is the staple flatbread of Ethiopian cuisine?', am: 'የኢትዮጵያ ምግብ ዋና ዳቦ ምንድን ነው?',
    opts: [['Injera', 'እንጀራ'], ['Dabo', 'ዳቦ'], ['Kita', 'ቂጣ'], ['Ambasha', 'አምባሻ']], answer: 0, d: 1 },
  { en: 'What is the name of Ethiopia’s currency?', am: 'የኢትዮጵያ ገንዘብ ስም ምንድን ነው?',
    opts: [['Birr', 'ብር'], ['Shilling', 'ሺሊንግ'], ['Nakfa', 'ናቕፋ'], ['Dinar', 'ዲናር']], answer: 0, d: 1 },
  { en: 'Which ancient city is home to the famous rock-hewn churches?', am: 'ታዋቂዎቹ ከአለት የተፈለፈሉ አብያተ ክርስቲያናት የት ይገኛሉ?',
    opts: [['Lalibela', 'ላሊበላ'], ['Axum', 'አክሱም'], ['Gondar', 'ጎንደር'], ['Harar', 'ሐረር']], answer: 0, d: 2 },
  { en: 'Coffee is believed to have originated in which Ethiopian region?', am: 'ቡና የመነጨው ከየትኛው የኢትዮጵያ አካባቢ ነው ተብሎ ይታመናል?',
    opts: [['Kaffa', 'ካፋ'], ['Wollo', 'ወሎ'], ['Sidama', 'ሲዳማ'], ['Gojjam', 'ጎጃም']], answer: 0, d: 2 },
  { en: 'Which empire/queen is linked to Ethiopia in ancient tradition?', am: 'በጥንታዊ ወግ ከኢትዮጵያ ጋር የሚገናኘው ንግሥት ማን ናት?',
    opts: [['Queen of Sheba', 'ንግሥተ ሳባ'], ['Cleopatra', 'ክሊዮፓትራ'], ['Nefertiti', 'ኔፈርቲቲ'], ['Boudica', 'ቡዲካ']], answer: 0, d: 2 },
  { en: 'Which mountain is the highest peak in Ethiopia?', am: 'በኢትዮጵያ ከፍተኛው ተራራ የትኛው ነው?',
    opts: [['Ras Dashen', 'ራስ ዳሸን'], ['Mount Bale', 'ባሌ ተራራ'], ['Mount Choke', 'ጮቄ ተራራ'], ['Mount Guna', 'ጉና ተራራ']], answer: 0, d: 2 },
  { en: 'In which year (Gregorian) did the Battle of Adwa take place?', am: 'የዓድዋ ጦርነት በየትኛው ዓመት (እ.አ.አ.) ተካሄደ?',
    opts: [['1896', '1896'], ['1886', '1886'], ['1900', '1900'], ['1935', '1935']], answer: 0, d: 2 },
  { en: 'What is the largest lake in Ethiopia?', am: 'በኢትዮጵያ ትልቁ ሐይቅ የትኛው ነው?',
    opts: [['Lake Tana', 'ጣና ሐይቅ'], ['Lake Abaya', 'አባያ ሐይቅ'], ['Lake Ziway', 'ዝዋይ ሐይቅ'], ['Lake Langano', 'ላንጋኖ ሐይቅ']], answer: 0, d: 2 },
  { en: 'Which script is used to write Amharic?', am: 'አማርኛ የሚጻፍበት ፊደል የትኛው ነው?',
    opts: [['Ge’ez (Fidäl)', 'ግዕዝ (ፊደል)'], ['Latin', 'ላቲን'], ['Arabic', 'ዓረብኛ'], ['Coptic', 'ቅብጢ']], answer: 0, d: 3 },
  { en: 'The Danakil Depression, one of Earth’s hottest places, lies in which region?', am: 'ከምድር ሙቅ ቦታዎች አንዱ የሆነው የዳናክል ቆላ የት ይገኛል?',
    opts: [['Afar', 'አፋር'], ['Tigray', 'ትግራይ'], ['Somali', 'ሶማሌ'], ['Oromia', 'ኦሮሚያ']], answer: 0, d: 3 },
  { en: 'Which Ethiopian emperor moved the capital to Addis Ababa in the 1880s?', am: 'በ1880ዎቹ ዋና ከተማን ወደ አዲስ አበባ ያዛወረው ንጉሠ ነገሥት ማን ነው?',
    opts: [['Menelik II', 'ዳግማዊ ምኒልክ'], ['Haile Selassie I', 'ቀዳማዊ ኃይለ ሥላሴ'], ['Tewodros II', 'ዳግማዊ ቴዎድሮስ'], ['Yohannes IV', 'ራብዓዊ ዮሐንስ']], answer: 0, d: 3 },
  { en: '“Lucy” (Dinkinesh), the famous hominid fossil, belongs to which species?', am: '“ሉሲ” (ድንቅነሽ) የተባለው ታዋቂ ቅሪተ አካል የየትኛው ዝርያ ነው?',
    opts: [['Australopithecus afarensis', 'አውስትራሎፒተክስ አፋረንሲስ'], ['Homo erectus', 'ሆሞ ኤሬክተስ'], ['Homo habilis', 'ሆሞ ሃቢሊስ'], ['Paranthropus', 'ፓራንትሮፐስ']], answer: 0, d: 3 },
  { en: 'How many years behind the Gregorian calendar is the Ethiopian calendar (roughly)?', am: 'የኢትዮጵያ ዘመን አቆጣጠር ከግሪጎሪያን በግምት ስንት ዓመት ወደ ኋላ ነው?',
    opts: [['7–8 years', '7–8 ዓመት'], ['5 years', '5 ዓመት'], ['10 years', '10 ዓመት'], ['3 years', '3 ዓመት']], answer: 0, d: 3 },
];

const STR = {
  en: { correct: 'Correct! 🎉', wrong: 'Not quite.', timeup: '⏱ Time up!', of: 'of' },
  am: { correct: 'ትክክል! 🎉', wrong: 'አልተሳካም።', timeup: '⏱ ጊዜው አለቀ!', of: 'ከ' },
};

const ROUND = 5;
const PER_Q_SECONDS = 10;
const WIN_CORRECT = 3;

let phase: Phase = 'menu';
let starting = false;
let sessionBest = 0;
let toastT = 0;

let round: Q[] = [];
let idx = 0;
let correct = 0;
let locked = false;
let roundStart = 0;
let qTimer: ReturnType<typeof setInterval> | undefined;
let qLeft = 0;
let timerPaused = false;

const toast = ensureToast('ethiopian-quiz-toast');
const elQ = $('#eq-question');
const elOpts = $('#eq-options');
const elMsg = $('#eq-message');

const lang = (): 'en' | 'am' => (getLang() === 'am' ? 'am' : 'en');
const s = (k: keyof typeof STR.en): string => STR[lang()][k];

function showToast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
}

function refreshMenu(): void {
  $('#freeMenu').innerHTML = renderFreeMenuHtml(host, sessionBest);
}

function showMenu(): void {
  $('#menuOverlay').classList.remove('hidden');
  $('#eqPlayFrame').classList.add('hidden');
  $('#eqBackdrop').classList.remove('hidden');
  hideOverOverlay();
}

function showGame(): void {
  $('#menuOverlay').classList.add('hidden');
  $('#eqPlayFrame').classList.remove('hidden');
  $('#eqBackdrop').classList.add('hidden');
}

function setPhase(next: Phase): void {
  phase = next;
  if (next === 'menu') showMenu();
  else showGame();
  $('#closeBtn').classList.toggle('hidden', next === 'menu' || next === 'over');
  $('#pauseOverlay').classList.toggle('hidden', next !== 'paused');
}

function showOverOverlay(score: number, correctCount: number, isRecord: boolean): void {
  const overlay = $('#overOverlay');
  $('#finalScore').textContent = score.toLocaleString();
  $('#finalBest').textContent = sessionBest > 0 ? sessionBest.toLocaleString() : '—';
  $('#eqOverSummary').textContent = `${correctCount} ${s('of')} ${ROUND}`;
  $('#newBest').classList.toggle('hidden', !isRecord);
  $('#runReward').innerHTML = '<span class="shell-rr-pending">…</span>';
  $('#closeBtn').classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideOverOverlay(): void {
  const overlay = $('#overOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function updateStats(): void {
  const score = correct * 20;
  $('#eqStatQ').textContent = round.length ? `${idx + 1}/${round.length}` : '—';
  $('#eqStatTime').textContent = phase === 'playing' && !locked ? `${Math.max(0, qLeft)}s` : '—';
  $('#eqStatScore').textContent = String(score);
}

function pickRound(): Q[] {
  const byTier = (d: 1 | 2 | 3): Q[] => shuffle(BANK.filter((q) => q.d === d));
  const want: (1 | 2 | 3)[] = [1, 1, 2, 2, 3];
  const pool = { 1: byTier(1), 2: byTier(2), 3: byTier(3) };
  const picked: Q[] = [];
  for (const d of want) {
    const q = pool[d].pop() ?? pool[3].pop() ?? pool[2].pop() ?? pool[1].pop();
    if (q && !picked.includes(q)) picked.push(q);
  }
  for (const q of shuffle(BANK)) {
    if (picked.length >= ROUND) break;
    if (!picked.includes(q)) picked.push(q);
  }
  return picked.slice(0, ROUND).sort((a, b) => a.d - b.d);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearQTimer(): void {
  if (qTimer) {
    clearInterval(qTimer);
    qTimer = undefined;
  }
  timerPaused = false;
}

function startQTimer(): void {
  clearQTimer();
  timerPaused = false;
  qTimer = setInterval(() => {
    if (phase !== 'playing' || locked) return;
    qLeft--;
    updateStats();
    if (qLeft <= 0) timeUp();
  }, 1000);
}

function beginQuiz(): void {
  round = pickRound();
  idx = 0;
  correct = 0;
  locked = false;
  roundStart = Date.now();
  elMsg.textContent = '';
  setPhase('playing');
  showQuestion();
}

function showQuestion(): void {
  if (phase !== 'playing') return;
  locked = false;
  elMsg.textContent = '';
  const q = round[idx];
  elQ.textContent = lang() === 'am' ? q.am : q.en;
  const order = shuffle(q.opts.map((_, i) => i));
  elOpts.innerHTML = order.map((oi) =>
    `<button type="button" class="eq-opt" data-i="${oi}">${lang() === 'am' ? q.opts[oi][1] : q.opts[oi][0]}</button>`,
  ).join('');
  elOpts.querySelectorAll<HTMLButtonElement>('.eq-opt').forEach((b) => {
    b.addEventListener('click', () => answer(Number(b.dataset.i), b));
  });
  qLeft = PER_Q_SECONDS;
  updateStats();
  startQTimer();
}

function timeUp(): void {
  if (locked || phase !== 'playing') return;
  locked = true;
  clearQTimer();
  elMsg.textContent = s('timeup');
  updateStats();
  setTimeout(() => advanceQuestion(), 900);
}

function answer(choice: number, btn: HTMLButtonElement): void {
  if (locked || phase !== 'playing') return;
  locked = true;
  clearQTimer();
  const q = round[idx];
  const right = choice === q.answer;
  if (right) {
    correct++;
    btn.classList.add('ok');
    sfx.coin();
  } else {
    btn.classList.add('bad');
    sfx.click();
    elOpts.querySelector<HTMLButtonElement>(`.eq-opt[data-i="${q.answer}"]`)?.classList.add('ok');
  }
  elMsg.textContent = right ? s('correct') : s('wrong');
  updateStats();
  setTimeout(() => advanceQuestion(), 1100);
}

function advanceQuestion(): void {
  if (phase !== 'playing') return;
  idx++;
  if (idx < round.length) showQuestion();
  else finishRound();
}

function finishRound(): void {
  clearQTimer();
  const score = correct * 20;
  const isWin = correct >= WIN_CORRECT;
  const isRecord = score > sessionBest;
  if (isRecord) sessionBest = score;
  refreshMenu();
  const timeMs = Date.now() - roundStart;
  elQ.textContent = '';
  elOpts.innerHTML = '';
  elMsg.textContent = '';
  updateStats();
  setPhase('over');
  showOverOverlay(score, correct, isRecord);
  void submitRun(score, isWin, timeMs, isRecord);
}

async function submitRun(
  score: number,
  isWin: boolean,
  durationMs: number,
  isRecord: boolean,
): Promise<void> {
  const reward = $('#runReward');
  if (!isConfigured()) {
    reward.innerHTML = '';
    $('#finalBest').textContent = sessionBest.toLocaleString();
    return;
  }
  reward.innerHTML = '<span class="shell-rr-pending">…</span>';
  const res = await submitFreeRun(host, score, isWin, durationMs);
  if (!res) {
    $('#finalBest').textContent = sessionBest.toLocaleString();
    $('#newBest').classList.toggle('hidden', !isRecord);
    if (await promptIfSessionExpired(showToast)) {
      reward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
    } else {
      reward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
    }
    return;
  }
  if (typeof res.best === 'number') sessionBest = Math.max(sessionBest, res.best);
  $('#finalBest').textContent = sessionBest.toLocaleString();
  $('#newBest').classList.toggle('hidden', !isRecord && !res.isRecord);
  reward.innerHTML = renderRunRewardHtml(res);
  refreshMenu();
}

async function onPlayOrEnter(): Promise<void> {
  if (starting || phase === 'playing' || phase === 'paused') return;
  starting = true;
  try {
    clearQTimer();
    if (!(await startFreeRound(host, toast))) return;
    hideOverOverlay();
    beginQuiz();
  } finally {
    starting = false;
  }
}

function pauseQuiz(): void {
  if (phase !== 'playing' || locked) return;
  clearQTimer();
  timerPaused = true;
  setPhase('paused');
}

function resumeQuiz(): void {
  if (phase !== 'paused') return;
  setPhase('playing');
  if (timerPaused && !locked && idx < round.length) {
    timerPaused = false;
    startQTimer();
  }
}

async function restartFromPause(): Promise<void> {
  if (phase !== 'paused') return;
  hideOverOverlay();
  await onPlayOrEnter();
}

$('#startBtn').addEventListener('click', () => void onPlayOrEnter());
$('#againBtn').addEventListener('click', () => void onPlayOrEnter());
$('#restartBtn').addEventListener('click', () => void restartFromPause());
$('#resumeBtn').addEventListener('click', () => resumeQuiz());
$('#pauseBtn').addEventListener('click', () => pauseQuiz());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') pauseQuiz();
});

document.documentElement.lang = getLang();
applyTranslations();
refreshMenu();
setPhase('menu');
