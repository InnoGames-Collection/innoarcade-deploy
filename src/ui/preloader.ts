// Reusable asset-loading screen. Shows a branded progress bar while an
// AssetStore.load() runs, then fades out. Created in the DOM (not the canvas) so
// it works before the first frame and respects the page's font/theme.

export class Preloader {
  private root: HTMLElement;
  private bar: HTMLElement;

  constructor(title = 'GoPlay') {
    const root = document.createElement('div');
    root.className = 'ia-preloader';
    root.innerHTML = `
      <div class="ia-preloader__inner">
        <div class="ia-preloader__logo">🕹️</div>
        <div class="ia-preloader__title">${title}</div>
        <div class="ia-preloader__track"><div class="ia-preloader__bar"></div></div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.bar = root.querySelector('.ia-preloader__bar')!;
    injectStyles();
  }

  set(progress: number): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  }

  done(): void {
    this.root.classList.add('ia-preloader--hidden');
    setTimeout(() => this.root.remove(), 450);
  }
}

function injectStyles(): void {
  if (document.getElementById('ia-preloader-styles')) return;
  const s = document.createElement('style');
  s.id = 'ia-preloader-styles';
  s.textContent = `
    .ia-preloader {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, #16203c 0%, #0a0d18 100%);
      transition: opacity .4s ease; color: #f3efe4;
      font-family: system-ui, -apple-system, 'Noto Sans Ethiopic', sans-serif;
    }
    .ia-preloader--hidden { opacity: 0; pointer-events: none; }
    .ia-preloader__inner { display: flex; flex-direction: column; align-items: center; gap: 18px; width: min(300px, 70vw); }
    .ia-preloader__logo { font-size: 3.2rem; animation: ia-bob 1.4s ease-in-out infinite; }
    .ia-preloader__title { font-size: 1.3rem; letter-spacing: .12em; text-transform: uppercase; color: #ffce54; }
    .ia-preloader__track { width: 100%; height: 8px; border-radius: 99px; background: rgba(255,255,255,.1); overflow: hidden; }
    .ia-preloader__bar { width: 0%; height: 100%; border-radius: 99px;
      background: linear-gradient(90deg, #ffce54, #fc6e51); transition: width .2s ease; }
    @keyframes ia-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`;
  document.head.appendChild(s);
}
