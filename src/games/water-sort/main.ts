// Water Sort — pour colored liquids into tubes until each holds one color. Native GoPlay game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { mountLQ } from '../_lq/lq';
import { runTubeSortGame, WATER_SORT_THEME } from '../_shared/tubeSort/runGame';

mountLQ('water-sort', (mount) => runTubeSortGame(mount, WATER_SORT_THEME), {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'time', labelKey: 'ws.time', icon: 'timer' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'moves' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
