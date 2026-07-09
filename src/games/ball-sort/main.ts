// Ball Sort — sort colored balls into tubes (shared rules with Water Sort). Native GoPlay game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { mountLQ } from '../_lq/lq';
import { runTubeSortGame, BALL_SORT_THEME } from '../_shared/tubeSort/runGame';

mountLQ('ball-sort', (mount) => runTubeSortGame(mount, BALL_SORT_THEME), {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
