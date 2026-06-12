// Shared settings panel — a modal overlay controlling the global Settings store
// and language. Built once per page and toggled open/closed. Every game mounts
// the same panel so audio, graphics quality, accessibility and language are
// consistent across the platform.

import { settings, type Palette, type Quality } from '../engine/settings';
import { sfx } from '../engine/audio';
import { applyTranslations, getLang, setLang, type Lang } from '../i18n';

export class SettingsPanel {
  private root: HTMLElement;
  private open = false;

  constructor() {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'ia-settings ia-settings--hidden';
    root.innerHTML = this.markup();
    document.body.appendChild(root);
    this.root = root;
    this.wire();
  }

  toggle(): void {
    this.open = !this.open;
    this.root.classList.toggle('ia-settings--hidden', !this.open);
    if (this.open) this.sync();
  }

  private markup(): string {
    return `
      <div class="ia-settings__scrim" data-close></div>
      <div class="ia-settings__card" role="dialog" aria-modal="true">
        <header><h2 data-i18n="set.title">Settings</h2>
          <button class="ia-settings__x" data-close aria-label="Close">✕</button></header>

        <label class="ia-settings__row"><span data-i18n="set.master">Master volume</span>
          <input type="range" min="0" max="100" data-k="master"></label>
        <label class="ia-settings__row"><span data-i18n="set.music">Music</span>
          <input type="range" min="0" max="100" data-k="music"></label>
        <label class="ia-settings__row"><span data-i18n="set.sfx">Sound effects</span>
          <input type="range" min="0" max="100" data-k="sfx"></label>

        <div class="ia-settings__row"><span data-i18n="set.quality">Graphics</span>
          <div class="ia-settings__seg" data-seg="quality">
            <button data-v="high" data-i18n="set.high">High</button>
            <button data-v="low" data-i18n="set.low">Low</button>
          </div></div>

        <div class="ia-settings__row"><span data-i18n="set.palette">Color mode</span>
          <select data-k="palette">
            <option value="default" data-i18n="set.palDefault">Default</option>
            <option value="deuteranopia">Deuteranopia</option>
            <option value="protanopia">Protanopia</option>
            <option value="tritanopia">Tritanopia</option>
          </select></div>

        <label class="ia-settings__row ia-settings__row--check">
          <span data-i18n="set.reducedMotion">Reduced motion</span>
          <input type="checkbox" data-k="reducedMotion"></label>

        <div class="ia-settings__row"><span data-i18n="set.language">Language</span>
          <div class="ia-settings__seg" data-seg="lang">
            <button data-v="en">EN</button>
            <button data-v="am">አማ</button>
          </div></div>
      </div>`;
  }

  private wire(): void {
    this.root.querySelectorAll('[data-close]').forEach((el) =>
      el.addEventListener('click', () => this.toggle()),
    );

    this.root.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((el) =>
      el.addEventListener('input', () => {
        settings.set(el.dataset.k as 'master' | 'music' | 'sfx', Number(el.value) / 100);
        sfx.syncMusicVolume();
      }),
    );

    const palette = this.root.querySelector<HTMLSelectElement>('select[data-k=palette]')!;
    palette.addEventListener('change', () => settings.set('palette', palette.value as Palette));

    const rm = this.root.querySelector<HTMLInputElement>('input[data-k=reducedMotion]')!;
    rm.addEventListener('change', () => settings.set('reducedMotion', rm.checked));

    this.root.querySelectorAll<HTMLButtonElement>('[data-seg=quality] button').forEach((b) =>
      b.addEventListener('click', () => {
        settings.set('quality', b.dataset.v as Quality);
        this.sync();
      }),
    );

    this.root.querySelectorAll<HTMLButtonElement>('[data-seg=lang] button').forEach((b) =>
      b.addEventListener('click', () => {
        setLang(b.dataset.v as Lang);
        applyTranslations(this.root);
        this.sync();
      }),
    );

    applyTranslations(this.root);
  }

  private sync(): void {
    const d = settings.data;
    (this.root.querySelector('[data-k=master]') as HTMLInputElement).value = String(d.master * 100);
    (this.root.querySelector('[data-k=music]') as HTMLInputElement).value = String(d.music * 100);
    (this.root.querySelector('[data-k=sfx]') as HTMLInputElement).value = String(d.sfx * 100);
    (this.root.querySelector('[data-k=palette]') as HTMLSelectElement).value = d.palette;
    (this.root.querySelector('[data-k=reducedMotion]') as HTMLInputElement).checked = d.reducedMotion;

    this.root.querySelectorAll<HTMLButtonElement>('[data-seg=quality] button').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.v === d.quality),
    );
    const lang = getLang();
    this.root.querySelectorAll<HTMLButtonElement>('[data-seg=lang] button').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.v === lang),
    );
  }
}

function injectStyles(): void {
  if (document.getElementById('ia-settings-styles')) return;
  const s = document.createElement('style');
  s.id = 'ia-settings-styles';
  s.textContent = `
    .ia-settings { position: fixed; inset: 0; z-index: 9998; display: flex; align-items: center; justify-content: center; }
    .ia-settings--hidden { display: none; }
    .ia-settings__scrim { position: absolute; inset: 0; background: rgba(6,9,18,.7); backdrop-filter: blur(4px); }
    .ia-settings__card { position: relative; width: min(360px, 90vw); max-height: 86vh; overflow-y: auto;
      background: #161d34; border: 1px solid rgba(120,160,255,.18); border-radius: 18px; padding: 20px 22px;
      color: #f3efe4; font-family: system-ui, 'Noto Sans Ethiopic', sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    .ia-settings__card header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .ia-settings__card h2 { font-size: 1.2rem; color: #ffce54; }
    .ia-settings__x { background: none; border: none; color: #9aa3c0; font-size: 1.1rem; cursor: pointer; }
    .ia-settings__row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 0;
      border-top: 1px solid rgba(255,255,255,.06); font-size: .92rem; }
    .ia-settings__row span { color: #c9d2ec; }
    .ia-settings__row input[type=range] { flex: 0 0 130px; accent-color: #fc6e51; }
    .ia-settings__row select { background: #0e1426; color: #f3efe4; border: 1px solid rgba(120,160,255,.25);
      border-radius: 8px; padding: 6px 8px; font-family: inherit; }
    .ia-settings__seg { display: inline-flex; border: 1px solid rgba(120,160,255,.25); border-radius: 99px; overflow: hidden; }
    .ia-settings__seg button { background: transparent; border: none; color: #9aa3c0; padding: 6px 14px; cursor: pointer; font-family: inherit; }
    .ia-settings__seg button.is-active { background: #fc6e51; color: #1a1207; font-weight: 700; }`;
  document.head.appendChild(s);
}
