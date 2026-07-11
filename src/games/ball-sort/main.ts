// Ball Sort — sort colored balls into tubes (shared rules with Water Sort). Native GoPlay game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import './modes.css';
import './polish.css';
import { mountLQ } from '../_lq/lq';
import { runTubeSortGame, BALL_SORT_THEME } from '../_shared/tubeSort/runGame';
import { installBallSortAudio } from './audio';
import { ballSortSound } from './audio';

installBallSortAudio();

function initBgParticles(): void {
  const layer = document.querySelector('body[data-game="ball-sort"] .bb-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'bb-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 30}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${6 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

function wireShellMenu(): void {
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.bb-mode-card:not(.bb-mode-card--locked)').forEach((card) => {
    card.addEventListener('click', () => {
      ballSortSound('click');
      startBtn?.click();
    });
  });
  document.getElementById('bsHomeBtn')?.addEventListener('click', () => {
    ballSortSound('click');
    if (history.length > 1) history.back();
    else location.href = '../../';
  });
}

mountLQ('ball-sort', (mount) => runTubeSortGame(mount, BALL_SORT_THEME), {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});

initBgParticles();
wireShellMenu();
