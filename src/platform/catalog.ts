// The game catalog — a single source of truth for every title on the platform.
// The hub, the tournaments view and the score pipeline all read from here, so a
// game appears everywhere the moment it is registered. `mode` decides whether a
// game shows up under Free Games, drives a Tournament, or both: a tournament
// game is still freely playable, it just also has a competitive leaderboard.

export type GameMode = 'free' | 'tournament';

export interface GameMeta {
  id: string;
  /** Path to the game's page, relative to the hub root. */
  route: string;
  nameEn: string;
  nameAm: string;
  genreEn: string;
  genreAm: string;
  mode: GameMode;
  /** Emoji used as a lightweight thumbnail/glyph until art is dropped in. */
  icon: string;
  /** Primary accent colour (hex) — themes the card and the in-game UI. */
  accent: string;
  /** Two-stop gradient for the thumbnail background. */
  thumb: [string, string];
  /** What the score represents, for the HUD/leaderboard ("Score", "Tiles"…). */
  scoreEn: string;
  scoreAm: string;
  /** Marks the flagship builds we polished for the partner demo. */
  featured?: boolean;
  /** Operator-tunable play economy for the ported awetar games. Drives the
   *  shared game host (see platform/gameHost.ts): `winPoints` is the score a win
   *  awards, `winRate` the base win chance (0–100) for chance games. Skill games
   *  ignore winRate. Absent for the engine-native games, which score by play. */
  play?: { winPoints: number; winRate: number };
}

export const CATALOG: GameMeta[] = [
  {
    id: 'orbit-blast',
    route: 'games/orbit-blast/',
    nameEn: 'Orbit Blast',
    nameAm: 'ኦርቢት ብላስት',
    genreEn: 'Arcade · Skill',
    genreAm: 'አርኬድ · ክህሎት',
    mode: 'tournament',
    icon: '🪐',
    accent: '#5b8cff',
    thumb: ['#1b2a6b', '#0a1130'],
    scoreEn: 'Score',
    scoreAm: 'ነጥብ',
    featured: true,
  },
  {
    id: 'merge-2048',
    route: 'games/merge-2048/',
    nameEn: 'Merge 2048',
    nameAm: 'መርጅ 2048',
    genreEn: 'Puzzle · Casual',
    genreAm: 'እንቆቅልሽ · ቀላል',
    mode: 'tournament',
    icon: '🔢',
    accent: '#f0a832',
    thumb: ['#b8741b', '#5c3409'],
    scoreEn: 'Score',
    scoreAm: 'ነጥብ',
    featured: true,
  },
  {
    id: 'temple-dash',
    route: 'games/temple-dash/',
    nameEn: 'Temple Dash',
    nameAm: 'ቤተመቅደስ ሩጫ',
    genreEn: 'Runner', genreAm: 'ሩጫ',
    mode: 'free', icon: '🏃', accent: '#e2563a', thumb: ['#7a2d1a', '#2a0f08'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'metro-rush',
    route: 'games/metro-rush/',
    nameEn: 'Metro Rush', nameAm: 'ሜትሮ ሩሽ',
    genreEn: 'Runner', genreAm: 'ሩጫ',
    mode: 'free', icon: '🚇', accent: '#36b3a8', thumb: ['#155f59', '#06211f'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'candy-crunch',
    route: 'games/candy-crunch/',
    nameEn: 'Candy Crunch', nameAm: 'ካንዲ ክራንች',
    genreEn: 'Match-3', genreAm: 'ሦስት-አዛምድ',
    mode: 'tournament', icon: '🍬', accent: '#e85b9c', thumb: ['#8c2b5c', '#2e0c1e'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'dot-link',
    route: 'games/dot-link/',
    nameEn: 'Dot Link', nameAm: 'ዶት ሊንክ',
    genreEn: 'Puzzle', genreAm: 'እንቆቅልሽ',
    mode: 'free', icon: '🔵', accent: '#5b8cff', thumb: ['#27408b', '#0b1430'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'brick-blitz',
    route: 'games/brick-blitz/',
    nameEn: 'Brick Blitz', nameAm: 'ብሪክ ብሊትዝ',
    genreEn: 'Arcade', genreAm: 'አርኬድ',
    mode: 'free', icon: '🧱', accent: '#f0a832', thumb: ['#9c5a14', '#331904'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'fruit-slice',
    route: 'games/fruit-slice/',
    nameEn: 'Fruit Slice', nameAm: 'ፍሩት ስላይስ',
    genreEn: 'Arcade', genreAm: 'አርኬድ',
    mode: 'free', icon: '🍉', accent: '#46c05a', thumb: ['#236f2c', '#0a2410'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'sky-hopper',
    route: 'games/sky-hopper/',
    nameEn: 'Sky Hopper', nameAm: 'ስካይ ሆፐር',
    genreEn: 'Arcade', genreAm: 'አርኬድ',
    mode: 'free', icon: '☁️', accent: '#56b8e8', thumb: ['#236a8c', '#0a2230'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'bubble-pop',
    route: 'games/bubble-pop/',
    nameEn: 'Bubble Pop', nameAm: 'ባብል ፖፕ',
    genreEn: 'Shooter', genreAm: 'ተኳሽ',
    mode: 'free', icon: '🫧', accent: '#7b6cf0', thumb: ['#3d2f8c', '#140d30'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },

  // --- Ported awetar titles -------------------------------------------------
  // `mode` is the casual↔tournament switch; `play` tunes the win reward/odds.
  {
    id: 'memory-match',
    route: 'games/memory-match/',
    nameEn: 'Memory Match', nameAm: 'ማች ማስታወሻ',
    genreEn: 'Puzzle · Casual', genreAm: 'እንቆቅልሽ · ቀላል',
    mode: 'tournament', icon: '🧩', accent: '#ff6b9d', thumb: ['#8c2b5c', '#0b1521'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 180, winRate: 50 },
  },
  {
    id: 'tap-game',
    route: 'games/tap-game/',
    nameEn: 'Tap Game', nameAm: 'ታፕ ጨዋታ',
    genreEn: 'Arcade · Reflex', genreAm: 'አርኬድ · ቅልጥፍና',
    mode: 'free', icon: '👆', accent: '#ff6b35', thumb: ['#7a2d1a', '#210a0a'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
    play: { winPoints: 150, winRate: 50 },
  },
  {
    id: 'dice-roll',
    route: 'games/dice-roll/',
    nameEn: 'Dice Roll', nameAm: 'ዳይስ ጨዋታ',
    genreEn: 'Chance · Tournament', genreAm: 'ዕድል · ውድድር',
    mode: 'tournament', icon: '🎲', accent: '#d18a04', thumb: ['#2f0999', '#0b6655'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 90, winRate: 35 },
  },
  {
    id: 'scratch-card',
    route: 'games/scratch-card/',
    nameEn: 'Scratch Card', nameAm: 'ስክራች ካርድ',
    genreEn: 'Chance · Casual', genreAm: 'ዕድል · ቀላል',
    mode: 'free', icon: '🎫', accent: '#f4d03f', thumb: ['#1a2530', '#111b24'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 80, winRate: 45 },
  },
  {
    id: 'lucky-box',
    route: 'games/lucky-box/',
    nameEn: 'Lucky Boxes', nameAm: 'ዕድለኛ ሳጥኖች',
    genreEn: 'Chance · Tournament', genreAm: 'ዕድል · ውድድር',
    mode: 'tournament', icon: '📦', accent: '#c77dff', thumb: ['#210d33', '#150921'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 100, winRate: 40 },
  },
  {
    id: 'spin-wheel',
    route: 'games/spin-wheel/',
    nameEn: 'Spin Wheel', nameAm: 'ስፒን ዊል',
    genreEn: 'Chance · Tournament', genreAm: 'ዕድል · ውድድር',
    mode: 'tournament', icon: '🌀', accent: '#d18a04', thumb: ['#2f0999', '#0b6655'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 120, winRate: 40 },
  },
  {
    id: 'luckyslot',
    route: 'games/luckyslot/',
    nameEn: 'Lucky Slot', nameAm: 'ሎኪ ስሎት',
    genreEn: 'Chance · Tournament', genreAm: 'ዕድል · ውድድር',
    mode: 'tournament', icon: '🎰', accent: '#d18a04', thumb: ['#2f0999', '#0d0020'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 100, winRate: 38 },
  },
  {
    id: 'popblast',
    route: 'games/popblast/',
    nameEn: 'Pop Blast', nameAm: 'ፖፕ ብላስት',
    genreEn: 'Match-3 · Casual', genreAm: 'ሦስት-አዛምድ · ቀላል',
    mode: 'free', icon: '💎', accent: '#a11fab', thumb: ['#2f0999', '#0b6655'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
    play: { winPoints: 150, winRate: 50 },
  },
  {
    id: 'crash-game',
    route: 'games/crash-game/',
    nameEn: 'Crash Game', nameAm: 'ክራሽ ጨዋታ',
    genreEn: 'Chance · Tournament', genreAm: 'ዕድል · ውድድር',
    mode: 'tournament', icon: '🚀', accent: '#d18a04', thumb: ['#2f0999', '#0b6655'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 50, winRate: 45 },
  },
  {
    id: 'ethiopian-quiz',
    route: 'games/ethiopian-quiz/',
    nameEn: 'Ethiopian Quiz', nameAm: 'የኢትዮጵያ ጥያቄ',
    genreEn: 'Trivia · Tournament', genreAm: 'ጥያቄ · ውድድር',
    mode: 'tournament', icon: '🇪🇹', accent: '#3f9e16', thumb: ['#1f7a14', '#0a3208'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 150, winRate: 50 },
  },
  // LexiQuest brain & word games, surfaced in the GoPlay catalog with the same
  // card style. They open in the LexiQuest app (their gameplay lives there).
  { id: 'sudoku', route: 'lexiquest/index.html#/g/sudoku', nameEn: 'Sudoku', nameAm: 'ሱዶኩ',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔢',
    accent: '#34b38a', thumb: ['#34b38a', '#176049'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'spell', route: 'lexiquest/index.html#/g/spell', nameEn: 'Spell It', nameAm: 'ፊደል ቃላት',
    genreEn: 'Word · Spelling', genreAm: 'ቃላት · ፊደል', mode: 'free', icon: '🔤',
    accent: '#6a4cff', thumb: ['#6a4cff', '#34238f'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'vocab', route: 'lexiquest/index.html#/g/vocab', nameEn: 'Vocabulary', nameAm: 'መዝገበ ቃላት',
    genreEn: 'Word · Vocabulary', genreAm: 'ቃላት · መዝገበ', mode: 'free', icon: '📖',
    accent: '#2aa9d6', thumb: ['#2aa9d6', '#13627e'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'rhyme', route: 'lexiquest/index.html#/g/rhyme', nameEn: 'Rhyme Time', nameAm: 'ግጥም',
    genreEn: 'Word · Rhyme', genreAm: 'ቃላት · ግጥም', mode: 'free', icon: '🎵',
    accent: '#e25aa0', thumb: ['#e25aa0', '#8e2c63'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'target24', route: 'lexiquest/index.html#/g/target24', nameEn: 'Target 24', nameAm: 'ኢላማ 24',
    genreEn: 'Brain · Math', genreAm: 'አእምሮ · ሒሳብ', mode: 'free', icon: '🎯',
    accent: '#f0a832', thumb: ['#f0a832', '#9c6310'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'crosssum', route: 'lexiquest/index.html#/g/crosssum', nameEn: 'Cross Sum', nameAm: 'ድምር',
    genreEn: 'Brain · Math', genreAm: 'አእምሮ · ሒሳብ', mode: 'free', icon: '➕',
    accent: '#5b8cff', thumb: ['#5b8cff', '#27468f'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'logic', route: 'lexiquest/index.html#/g/logic', nameEn: 'Logic Grid', nameAm: 'ሎጂክ',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🧩',
    accent: '#ff7a59', thumb: ['#ff7a59', '#a83b22'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'sequence', route: 'lexiquest/index.html#/g/sequence', nameEn: 'Sequence', nameAm: 'ቅደም ተከተል',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔗',
    accent: '#7a6cff', thumb: ['#7a6cff', '#3d2f9e'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
];

// Preferred display order for the flat catalog: these lead (in this order), then
// every other game follows in catalog order.
const FEATURED_ORDER = [
  'popblast', 'luckyslot', 'memory-match', 'merge-2048', 'spin-wheel',
  'ethiopian-quiz', 'dice-roll', 'lucky-box', 'temple-dash', 'sudoku',
];

/** The full catalog sorted for display (featured games first, then the rest). */
export function orderedCatalog(): GameMeta[] {
  const rank = (g: GameMeta): number => {
    const i = FEATURED_ORDER.indexOf(g.id);
    return i < 0 ? FEATURED_ORDER.length + CATALOG.indexOf(g) : i;
  };
  return [...CATALOG].sort((a, b) => rank(a) - rank(b));
}

const byId = new Map(CATALOG.map((g) => [g.id, g]));

export function getGame(id: string): GameMeta | undefined {
  return byId.get(id);
}

export function freeGames(): GameMeta[] {
  return CATALOG.filter((g) => g.mode === 'free');
}

export function tournamentGames(): GameMeta[] {
  return CATALOG.filter((g) => g.mode === 'tournament');
}
