import '../styles/base.css';
import './hub.css';
import { applyTranslations, getLang, setLang, type Lang } from '../i18n';

const langEn = document.querySelector<HTMLButtonElement>('#langEn')!;
const langAm = document.querySelector<HTMLButtonElement>('#langAm')!;

function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
}

function pick(lang: Lang): void {
  setLang(lang);
  syncLangButtons();
}

langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
