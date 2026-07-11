// The game catalog — a single source of truth for every title on the platform.
// The hub, the tournaments view and the score pipeline all read from here, so a
// game appears everywhere the moment it is registered. `mode` decides whether a
// game shows up under Free Games, drives a Tournament, or both: a tournament
// game is still freely playable, it just also has a competitive leaderboard.

export type GameMode = 'free' | 'tournament';
/** Tournament cadence — each tournament game runs exactly one of these. */
export type TournamentCadence = 'daily' | 'weekly' | 'monthly';

/** Hub category chips — used for browse shelves and filters. */
export type GameCategory = 'puzzle' | 'arcade' | 'brain' | 'action' | 'sports' | 'kids' | 'trivia' | 'tournament';

export interface GameMeta {
  id: string;
  /** Path to the game's page, relative to the hub root. */
  route: string;
  nameEn: string;
  nameAm: string;
  genreEn: string;
  genreAm: string;
  mode: GameMode;
  /** For tournament games: which cadence this game competes on (one each). */
  tournament?: TournamentCadence;
  /** Emoji used as a lightweight thumbnail/glyph until art is dropped in. */
  icon: string;
  /** Primary accent colour (hex) — themes the card and the in-game UI. */
  accent: string;
  /** Two-stop gradient for the thumbnail background. */
  thumb: [string, string];
  /** Optional cover image for the catalog card (path relative to the hub root,
   *  e.g. a file in /public). When set it replaces the emoji glyph on the card. */
  cover?: string;
  /** Level-gating: locked until the player reaches `minLevel`, or unlocked early
   *  for `unlockCost` coins. Absent → always playable. */
  minLevel?: number;
  unlockCost?: number;
  /** What the score represents, for the HUD/leaderboard ("Score", "Tiles"…). */
  scoreEn: string;
  scoreAm: string;
  /** Marks the flagship builds we polished for the partner demo. */
  featured?: boolean;
  /** Hub browse category — derived from genre when omitted. */
  category?: GameCategory;
  /** ISO date for "Recently added" shelves and NEW badges. */
  addedAt?: string;
  /** Estimated session length shown on catalog cards (minutes). */
  estMinutes?: number;
  /** Manual portal badge until analytics-driven trending ships. */
  badge?: 'hot' | 'new';
  /** Display rating (0–5) on catalog cards — static default until player ratings exist. */
  rating?: number;
  /** Frozen release tag — do not change game code unless the operator explicitly requests it. */
  stable?: string;
  /** Per-game play tuning for the shared game host (platform/gameHost.ts):
   *   • winRate — base win chance (0–100) for chance games.
   *   • winScore — win threshold for skill/engine games (score ≥ this = a win).
   *  Points are NOT set here: every win awards the flat platform WIN_POINTS.
   *  (`winPoints` retained as a no-op for back-compat with older entries.) */
  play?: { winPoints?: number; winRate?: number; winScore?: number };
}

const ALL_GAMES: GameMeta[] = [
  {
    id: 'orbit-blast',
    route: 'games/orbit-blast/',
    nameEn: 'Ball Shooter',
    nameAm: 'ቦል ሹተር',
    genreEn: 'Arcade · Skill',
    genreAm: 'አርኬድ · ክህሎት',
    mode: 'free',
    stable: 'v2',
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
    nameEn: '2048',
    nameAm: '2048',
    genreEn: 'Puzzle · Casual',
    genreAm: 'እንቆቅልሽ · ቀላል',
    mode: 'free',
    stable: 'v1',
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
    nameEn: 'Ethiorunner',
    nameAm: 'ኢትዮሯጭ',
    genreEn: 'Runner · Arcade', genreAm: 'ሩጫ · አርኬድ',
    mode: 'free', stable: 'v3', icon: '🏃', accent: '#e2563a', thumb: ['#7a2d1a', '#2a0f08'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'candy-crunch',
    route: 'games/candy-crunch/',
    nameEn: 'Candy Saga', nameAm: 'ካንዲ ሳጋ',
    genreEn: 'Match-3', genreAm: 'ሦስት-አዛምድ',
    mode: 'free', icon: '🍬', accent: '#e85b9c', thumb: ['#8c2b5c', '#2e0c1e'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'brick-blitz',
    route: 'games/brick-blitz/',
    nameEn: 'Brick Blitz', nameAm: 'ብሪክ ብሊትዝ',
    genreEn: 'Arcade', genreAm: 'አርኬድ',
    mode: 'free', stable: 'v1', icon: '🧱', accent: '#f0a832', thumb: ['#9c5a14', '#331904'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },
  {
    id: 'fruit-slice',
    route: 'games/fruit-slice/',
    nameEn: 'Fruit Slice', nameAm: 'ፍሩት ስላይስ',
    genreEn: 'Arcade · Tournament', genreAm: 'አርኬድ · ውድድር',
    mode: 'tournament', tournament: 'weekly', stable: 'v1', icon: '🍉', accent: '#46c05a', thumb: ['#236f2c', '#0a2410'],
    cover: '/fruit_slice.webp',
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
    mode: 'free', stable: 'v1', icon: '🫧', accent: '#7b6cf0', thumb: ['#3d2f8c', '#140d30'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
  },

  // --- Chance + casual games (built-in) --------------------------------------
  {
    id: 'memory-match',
    route: 'games/memory-match/',
    nameEn: 'Memory Match', nameAm: 'ማች ማስታወሻ',
    genreEn: 'Puzzle · Tournament', genreAm: 'እንቆቅልሽ · ውድድር',
    mode: 'tournament', tournament: 'monthly', stable: 'v1', icon: '🧩', accent: '#ff6b9d', thumb: ['#8c2b5c', '#0b1521'],
    cover: '/memory_match.webp',
    scoreEn: 'Score', scoreAm: 'ነጥብ',
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
    id: 'lucky-box',
    route: 'games/lucky-box/',
    nameEn: 'Lucky Boxes', nameAm: 'ዕድለኛ ሳጥኖች',
    genreEn: 'Chance · Casual', genreAm: 'ዕድል · ቀላል',
    mode: 'free', icon: '📦', accent: '#c77dff', thumb: ['#210d33', '#150921'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 100, winRate: 40 },
  },
  {
    id: 'spin-wheel',
    route: 'games/spin-wheel/',
    nameEn: 'Spin Wheel', nameAm: 'ስፒን ዊል',
    genreEn: 'Chance · Casual', genreAm: 'ዕድል · ቀላል',
    mode: 'free', icon: '🌀', accent: '#d18a04', thumb: ['#2f0999', '#0b6655'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 120, winRate: 40 },
  },
  {
    id: 'luckyslot',
    route: 'games/luckyslot/',
    nameEn: 'Lucky Slot', nameAm: 'ሎኪ ስሎት',
    genreEn: 'Chance · Casual', genreAm: 'ዕድል · ቀላል',
    mode: 'free', icon: '🎰', accent: '#d18a04', thumb: ['#2f0999', '#0d0020'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 100, winRate: 38 },
  },
  {
    id: 'popblast',
    route: 'games/popblast/',
    nameEn: 'Candy Blast', nameAm: 'ካንዲ ብላስት',
    genreEn: 'Match-3 · Casual', genreAm: 'ሦስት-አዛምድ · ቀላል',
    mode: 'free', stable: 'v1', icon: '🍬', accent: '#e85b9c', thumb: ['#8c2b5c', '#2e0c1e'],
    scoreEn: 'Score', scoreAm: 'ነጥብ',
    play: { winPoints: 150, winRate: 50 },
  },
  {
    id: 'ethiopian-quiz',
    route: 'games/ethiopian-quiz/',
    nameEn: 'Ethiopian Quiz', nameAm: 'የኢትዮጵያ ጥያቄ',
    genreEn: 'Trivia · Casual', genreAm: 'ጥያቄ · ቀላል',
    mode: 'free', stable: 'v1', icon: '🇪🇹', accent: '#3f9e16', thumb: ['#1f7a14', '#0a3208'],
    scoreEn: 'Points', scoreAm: 'ነጥብ',
    play: { winPoints: 150, winRate: 50 },
  },
  // Brain & word games — native GoPlay games (formerly the vendored LexiQuest
  // app), each on its own page, scored through the server like every other game.
  { id: 'sudoku', route: 'games/sudoku/index.html', nameEn: 'Sudoku', nameAm: 'ሱዶኩ',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔢',
    accent: '#34b38a', thumb: ['#34b38a', '#176049'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'spell', route: 'games/spell/index.html', nameEn: 'Spell Trivia', nameAm: 'ፊደል ጥያቄ',
    genreEn: 'Word · Spelling', genreAm: 'ቃላት · ፊደል', mode: 'free', stable: 'v1', icon: '🔤',
    accent: '#6a4cff', thumb: ['#6a4cff', '#34238f'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'vocab', route: 'games/vocab/index.html', nameEn: 'Vocabulary', nameAm: 'መዝገበ ቃላት',
    genreEn: 'Word · Vocabulary', genreAm: 'ቃላት · መዝገበ', mode: 'free', icon: '📖',
    accent: '#2aa9d6', thumb: ['#2aa9d6', '#13627e'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'rhyme', route: 'games/rhyme/index.html', nameEn: 'Rhyme Time', nameAm: 'ግጥም',
    genreEn: 'Word · Rhyme', genreAm: 'ቃላት · ግጥም', mode: 'free', icon: '🎵',
    accent: '#e25aa0', thumb: ['#e25aa0', '#8e2c63'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'target24', route: 'games/target24/index.html', nameEn: 'Target 24', nameAm: 'ኢላማ 24',
    genreEn: 'Brain · Math', genreAm: 'አእምሮ · ሒሳብ', mode: 'free', icon: '🎯',
    accent: '#f0a832', thumb: ['#f0a832', '#9c6310'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'crosssum', route: 'games/crosssum/index.html', nameEn: 'Cross Sum', nameAm: 'ድምር',
    genreEn: 'Brain · Math', genreAm: 'አእምሮ · ሒሳብ', mode: 'free', icon: '➕',
    accent: '#5b8cff', thumb: ['#5b8cff', '#27468f'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'logic', route: 'games/logic/index.html', nameEn: 'Logic Grid', nameAm: 'ሎጂክ',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🧩',
    accent: '#ff7a59', thumb: ['#ff7a59', '#a83b22'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'sequence', route: 'games/sequence/index.html', nameEn: 'Sequence', nameAm: 'ቅደም ተከተል',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔗',
    accent: '#7a6cff', thumb: ['#7a6cff', '#3d2f9e'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'water-sort', route: 'games/water-sort/index.html', nameEn: 'Water Sort', nameAm: 'ውሃ መደርደር',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🧪',
    accent: '#2aa9d6', thumb: ['#2aa9d6', '#13627e'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'parking-jam', route: 'games/parking-jam/index.html', nameEn: 'Parking Jam', nameAm: 'ፓርኪንግ',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🚗',
    accent: '#5b8cff', thumb: ['#27468f', '#0a1130'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'laser-puzzle', route: 'games/laser-puzzle/index.html', nameEn: 'Laser Puzzle', nameAm: 'ሌዘር',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔴',
    accent: '#e74c3c', thumb: ['#8c2b2b', '#2a0c0c'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'piano-tiles', route: 'games/piano-tiles/index.html', nameEn: 'Piano Tiles', nameAm: 'ፒያኖ',
    genreEn: 'Arcade · Reflex', genreAm: 'አርኬድ · ቅልጥፍና', mode: 'free', icon: '🎹',
    accent: '#1a1a2e', thumb: ['#4a4a6a', '#0d0d18'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'stack-tower', route: 'games/stack-tower/index.html', nameEn: 'Stack Tower', nameAm: 'Stack Tower',
    genreEn: 'Arcade · Skill', genreAm: 'አርኬድ · ክህሎት', mode: 'free', icon: '🗼',
    accent: '#f39c12', thumb: ['#b8741b', '#3d2808'], scoreEn: 'Height', scoreAm: 'ቁመት' },
  { id: 'crossy-road', route: 'games/crossy-road/index.html', nameEn: 'Crossy Road', nameAm: 'Crossy Road',
    genreEn: 'Runner · Arcade', genreAm: 'ሩጫ · አርኬድ', mode: 'free', stable: 'v1', icon: '🐔',
    accent: '#6ab04c', thumb: ['#3d7a2c', '#142a0c'], scoreEn: 'Distance', scoreAm: 'ርቀት' },
  { id: 'block-blast', route: 'games/block-blast/index.html', nameEn: 'Block Blast', nameAm: 'Block Blast',
    genreEn: 'Puzzle · Casual', genreAm: 'እንቆቅልሽ · ቀላል', mode: 'free', icon: '🟦',
    accent: '#5b8cff', thumb: ['#27468f', '#0a1130'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'tile-connect', route: 'games/tile-connect/index.html', nameEn: 'Tile Connect', nameAm: 'Tile Connect',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔗',
    accent: '#7a6cff', thumb: ['#4a3d9e', '#1a1430'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'hexa-block', route: 'games/hexa-block/index.html', nameEn: 'Hexa Block', nameAm: 'Hexa Block',
    genreEn: 'Puzzle · Casual', genreAm: 'እንቆቅልሽ · ቀላል', mode: 'free', icon: '⬡',
    accent: '#1abc9c', thumb: ['#0e7a66', '#052a24'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'knife-hit', route: 'games/knife-hit/index.html', nameEn: 'Knife Hit', nameAm: 'Knife Hit',
    genreEn: 'Arcade · Skill', genreAm: 'አርኬድ · ክህሎት', mode: 'free', icon: '🔪',
    accent: '#8B4513', thumb: ['#5c2e0e', '#1a0d04'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'helix-jump', route: 'games/helix-jump/index.html', nameEn: 'Helix Jump', nameAm: 'Helix Jump',
    genreEn: 'Arcade · Skill', genreAm: 'አርኬድ · ክህሎት', mode: 'free', stable: 'v1', icon: '🌀',
    accent: '#5b8cff', thumb: ['#2a4080', '#0a1020'], scoreEn: 'Depth', scoreAm: 'ጥልቀት' },
  { id: 'hill-climb', route: 'games/hill-climb/index.html', nameEn: 'Hill Climb', nameAm: 'Hill Climb',
    genreEn: 'Arcade · Skill', genreAm: 'አርኬድ · ክህሎት', mode: 'free', icon: '🚙',
    accent: '#e74c3c', thumb: ['#8c2b2b', '#2a0c0c'], scoreEn: 'Distance', scoreAm: 'ርቀት' },
  { id: 'tower-defense', route: 'games/tower-defense/index.html', nameEn: 'Tower Defense', nameAm: 'Tower Defense',
    genreEn: 'Strategy · Arcade', genreAm: 'ስትራቴጂ · አርኬድ', mode: 'free', icon: '🏰',
    accent: '#6ab04c', thumb: ['#3d7a2c', '#142a0c'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'draw-bridge', route: 'games/draw-bridge/index.html', nameEn: 'Draw Bridge', nameAm: 'Draw Bridge',
    genreEn: 'Puzzle · Physics', genreAm: 'እንቆቅልሽ · ፊዚክስ', mode: 'free', icon: '🌉',
    accent: '#8B7355', thumb: ['#5c4a32', '#1a140c'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'ball-sort', route: 'games/ball-sort/index.html', nameEn: 'Ball Sort', nameAm: 'Ball Sort',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '⚪',
    accent: '#9b59b6', thumb: ['#5c348c', '#1a0c2a'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'jewel-match', route: 'games/jewel-match/index.html', nameEn: 'Jewel Match', nameAm: 'Jewel Match',
    genreEn: 'Puzzle · Match', genreAm: 'እንቆቅልሽ · Match', mode: 'free', icon: '💎',
    accent: '#9b59b6', thumb: ['#5c348c', '#1a0c2a'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'reflex-tap', route: 'games/reflex-tap/index.html', nameEn: 'Reflex Tap', nameAm: 'Reflex Tap',
    genreEn: 'Arcade · Reflex', genreAm: 'አርኬድ · ሪፍሌክስ', mode: 'free', icon: '⚡',
    accent: '#f39c12', thumb: ['#b8750c', '#2a1a04'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'doodle-jump', route: 'games/doodle-jump/index.html', nameEn: 'Doodle Jump', nameAm: 'Doodle Jump',
    genreEn: 'Arcade · Platform', genreAm: 'አርኬድ · ፕላትፎርም', mode: 'free', icon: '🦘',
    accent: '#6c5ce7', thumb: ['#4a3a9c', '#140c2a'], scoreEn: 'Height', scoreAm: 'ቁመት' },
  { id: 'zigzag', route: 'games/zigzag/index.html', nameEn: 'ZigZag', nameAm: 'ZigZag',
    genreEn: 'Arcade · Runner', genreAm: 'አርኬድ · ራነር', mode: 'free', icon: '〰️',
    accent: '#00cec9', thumb: ['#008b88', '#042a2a'], scoreEn: 'Distance', scoreAm: 'ርቀት' },
  { id: 'color-switch', route: 'games/color-switch/index.html', nameEn: 'Color Switch', nameAm: 'Color Switch',
    genreEn: 'Arcade · Reflex', genreAm: 'አርኬድ · ሪፍሌክስ', mode: 'free', icon: '🎨',
    accent: '#e84393', thumb: ['#9c2d63', '#2a0c1a'], scoreEn: 'Gates', scoreAm: 'በር' },
  { id: 'rope-rescue', route: 'games/rope-rescue/index.html', nameEn: 'Rope Rescue', nameAm: 'Rope Rescue',
    genreEn: 'Puzzle · Physics', genreAm: 'እንቆቅልሽ · ፊዚክስ', mode: 'free', icon: '🪢',
    accent: '#e67e22', thumb: ['#9c5410', '#2a1404'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'pipe-connect', route: 'games/pipe-connect/index.html', nameEn: 'Pipe Connect', nameAm: 'Pipe Connect',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🔧',
    accent: '#3498db', thumb: ['#1f5f8b', '#0c1a2a'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'ball-maze', route: 'games/ball-maze/index.html', nameEn: 'Ball Maze', nameAm: 'Ball Maze',
    genreEn: 'Arcade · Maze', genreAm: 'አርኬድ · ሜዝ', mode: 'free', icon: '🔮',
    accent: '#e17055', thumb: ['#9c4a38', '#2a100c'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'arrow-shot', route: 'games/arrow-shot/index.html', nameEn: 'Arrow Shot', nameAm: 'Arrow Shot',
    genreEn: 'Arcade · Skill', genreAm: 'አርኬድ · ክህሎት', mode: 'free', icon: '🏹',
    accent: '#8B7355', thumb: ['#5c4a32', '#1a140c'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'slide-puzzle', route: 'games/slide-puzzle/index.html', nameEn: 'Slide Puzzle', nameAm: 'Slide Puzzle',
    genreEn: 'Brain · Logic', genreAm: 'አእምሮ · ሎጂክ', mode: 'free', icon: '🧩',
    accent: '#74b9ff', thumb: ['#4a7aa8', '#0c1a2a'], scoreEn: 'Score', scoreAm: 'ነጥብ' },
  { id: 'race-car', route: 'games/race-car/index.html', nameEn: 'Race Car', nameAm: 'Race Car',
    genreEn: 'Arcade · Racing', genreAm: 'አርኬድ · ሩጫ', mode: 'free', icon: '🏎️',
    accent: '#d63031', thumb: ['#8c2020', '#2a0808'], scoreEn: 'Distance', scoreAm: 'ርቀት' },
];

// Storefront gating: free games ship by default; tournament games are opt-in via
// ENABLED. Every game above is fully built — re-enable a tournament title by adding
// its id here (a one-line change).
const ENABLED_TOURNAMENT = new Set<string>(['memory-match', 'fruit-slice']);
/** Hidden from the hub until re-enabled (game code may remain in the repo). */
const HIDDEN_GAMES = new Set<string>(['candy-crunch']);
export const CATALOG: GameMeta[] = ALL_GAMES.filter(
  (g) => !HIDDEN_GAMES.has(g.id) && (g.mode === 'free' || ENABLED_TOURNAMENT.has(g.id)),
);

// WebP cover art for the catalog cards (files live in /public). Attached to the
// catalog entries below so a card shows the artwork instead of the emoji glyph.
const COVERS: Record<string, string> = {
  'popblast': 'candy_blast.webp',
  'temple-dash': 'temple_dash.webp',
  'orbit-blast': 'orbit_blast.webp',
  'luckyslot': 'lucky_slot.webp',
  'merge-2048': 'merge_2048.webp',
  'lucky-box': 'lucky_boxes.webp',
  'spin-wheel': 'spin_wheel.webp',
  'memory-match': 'memory_match.webp',
  'ethiopian-quiz': 'ethiopian_quiz.webp',
  'sudoku': 'sudoku.webp',
  'candy-crunch': 'candy_saga.webp',
  'brick-blitz': 'brick_blitz.webp',
  'fruit-slice': 'fruit_slice.webp',
  'sky-hopper': 'sky_hopper.webp',
  'bubble-pop': 'bubble_pop.webp',
  'tap-game': 'tap_game.webp',
  'spell': 'spell_quiz.webp',
  'vocab': 'vocabulary_trivia.webp',
  'rhyme': 'rhyme_time.webp',
  'target24': 'target_24.webp',
  'crosssum': 'cross_sum.webp',
  'logic': 'logic_grid.webp',
  'sequence': 'sequence.webp',
  'water-sort': 'water_sort.webp',
  'parking-jam': 'parking_jam.webp',
  'laser-puzzle': 'laser_puzzle.webp',
  'piano-tiles': 'piano_tiles.webp',
  'stack-tower': 'stack_tower.webp',
  'crossy-road': 'crossy_road.webp',
  'block-blast': 'block_blast.webp',
  'tile-connect': 'tile_connect.webp',
  'hexa-block': 'hexa_block.webp',
  'knife-hit': 'knife_hit.webp',
  'helix-jump': 'helix_jump.webp',
  'hill-climb': 'hill_climb.webp',
  'tower-defense': 'tower_defense.webp',
  'draw-bridge': 'draw_bridge.webp',
  'ball-sort': 'ball_sort.webp',
  'jewel-match': 'jewel_match.webp',
  'reflex-tap': 'reflex_tap.webp',
  'doodle-jump': 'doodle_jump.webp',
  'zigzag': 'zigzag.webp',
  'color-switch': 'color_switch.webp',
  'rope-rescue': 'rope_rescue.webp',
  'pipe-connect': 'pipe_connect.webp',
  'ball-maze': 'ball_maze.webp',
  'arrow-shot': 'arrow_shot.webp',
  'slide-puzzle': 'slide_puzzle.webp',
  'race-car': 'race_car.webp',
};
for (const g of CATALOG) { if (COVERS[g.id]) g.cover = COVERS[g.id]; }

// Win thresholds for skill/engine games (score ≥ this = client "win" flag on submit).
// Tournament RP uses server game_par + raw score — not winScore. See catalog vs migrations.
const WIN_SCORE: Record<string, number> = {
  'orbit-blast': 1000, 'merge-2048': 512, 'temple-dash': 300,
  'candy-crunch': 1000, 'brick-blitz': 1000, 'fruit-slice': 300,
  'sky-hopper': 300, 'bubble-pop': 1000, 'popblast': 500,
  // Composite quiz: correct×pts + speed bonus + session time left
  'ethiopian-quiz': 100, 'spell': 70, 'vocab': 70, 'logic': 70, 'rhyme': 60,
  // Brain: time-based formulas in _lq/scoring.ts
  'sudoku': 120, 'crosssum': 110, 'target24': 70, 'sequence': 150,
  'water-sort': 280,
  'parking-jam': 300,
  'laser-puzzle': 260,
  'piano-tiles': 300,
  'stack-tower': 200,
  'crossy-road': 140,
  'block-blast': 160,
  'tile-connect': 280,
  'hexa-block': 150,
  'knife-hit': 220,
  'helix-jump': 180,
  'hill-climb': 140,
  'tower-defense': 280,
  'draw-bridge': 220,
  'ball-sort': 280,
  'jewel-match': 2400,
  'reflex-tap': 140,
  'doodle-jump': 220,
  'zigzag': 120,
  'color-switch': 100,
  'rope-rescue': 200,
  'pipe-connect': 240,
  'ball-maze': 180,
  'arrow-shot': 170,
  'slide-puzzle': 220,
  'race-car': 120,
  'tap-game': 50,
};
for (const g of CATALOG) {
  if (WIN_SCORE[g.id] != null) g.play = { ...(g.play ?? {}), winScore: WIN_SCORE[g.id] };
}

// Level-gated games: locked until the player reaches `minLevel`, or unlocked
// early with coins (server-validated cost). Mirror of GATE in unlock-game fn.
const GATE: Record<string, { minLevel: number; unlockCost: number }> = {
  'luckyslot': { minLevel: 2, unlockCost: 50 },
  'spin-wheel': { minLevel: 2, unlockCost: 50 },
  'target24': { minLevel: 2, unlockCost: 50 },
  'logic': { minLevel: 2, unlockCost: 50 },
  'sequence': { minLevel: 3, unlockCost: 100 },
};
for (const g of CATALOG) {
  const gate = GATE[g.id];
  if (gate) { g.minLevel = gate.minLevel; g.unlockCost = gate.unlockCost; }
}

// Locked production games — explicit stable tags only (see STABLE.md).
// All pre-existing titles are frozen; new games are added without touching these.
const STABLE_VERSIONS: Record<string, string> = {
  'temple-dash': 'v3',
  'orbit-blast': 'v2',
  'merge-2048': 'v1',
  'candy-crunch': 'v1',
  'brick-blitz': 'v1',
  'fruit-slice': 'v1',
  'crossy-road': 'v1',
  'helix-jump': 'v1',
  'sky-hopper': 'v1',
  'bubble-pop': 'v1',
  'memory-match': 'v1',
  'tap-game': 'v1',
  'lucky-box': 'v1',
  'spin-wheel': 'v1',
  'luckyslot': 'v1',
  'popblast': 'v1',
  'ethiopian-quiz': 'v1',
  'sudoku': 'v1',
  'spell': 'v1',
  'vocab': 'v1',
  'rhyme': 'v1',
  'target24': 'v1',
  'crosssum': 'v1',
  'logic': 'v1',
  'sequence': 'v1',
};
for (const g of CATALOG) {
  const tag = STABLE_VERSIONS[g.id];
  if (tag) g.stable = tag;
}

// Display order for the flat catalog:
//   1. FRONT games lead, in this exact order;
//   2. then the rest in catalog order;
//   3. except BOTTOM games, pinned to the very end.
const FRONT = [
  // Free games (hub order)
  'temple-dash',
  'popblast',
  'ethiopian-quiz',
  'orbit-blast',
  'spell',
  'spin-wheel',
  'tap-game',
  'crosssum',
  'lucky-box',
  'brick-blitz',
  'sky-hopper',
  'luckyslot',
  'sudoku',
  'logic',
  'merge-2048',
  'vocab',
  'rhyme',
  'target24',
  'sequence',
  'bubble-pop',
  // Tournament (enabled titles)
  'memory-match',
  'fruit-slice',
];
const BOTTOM: string[] = [];

/** The full catalog sorted for display (front-runners, middle, then pinned). */
export function orderedCatalog(): GameMeta[] {
  const rank = (g: GameMeta): number => {
    const f = FRONT.indexOf(g.id);
    if (f >= 0) return f;
    const b = BOTTOM.indexOf(g.id);
    if (b >= 0) return 10_000 + b;
    return 1_000 + CATALOG.indexOf(g);
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

// --- Portal metadata (hub shelves, chips, teasers) ---------------------------

/** Teaser tiles for titles not yet in the storefront. */
export interface ComingSoonMeta {
  id: string;
  nameEn: string;
  nameAm: string;
  icon: string;
  thumb: [string, string];
  cover?: string;
  etaEn?: string;
  etaAm?: string;
}

export const COMING_SOON_COVERS: Record<string, string> = {
  'traffic-master': '/traffic_master.webp',
  'city-rush': '/city_rush.webp',
  'mega-match': '/mega_match.webp',
  'ninja-dash': '/ninja_dash.webp',
};

export const COMING_SOON: ComingSoonMeta[] = [
  { id: 'traffic-master', nameEn: 'Traffic Master', nameAm: 'Traffic Master', icon: '🚦', thumb: ['#c0392b', '#2a0808'], cover: COMING_SOON_COVERS['traffic-master'], etaEn: 'Coming Q3', etaAm: 'በቅርብ Q3' },
  { id: 'city-rush', nameEn: 'City Rush', nameAm: 'City Rush', icon: '🏙️', thumb: ['#3498db', '#0c1a2a'], cover: COMING_SOON_COVERS['city-rush'], etaEn: 'Coming soon', etaAm: 'በቅርብ ቀን' },
  { id: 'mega-match', nameEn: 'Mega Match', nameAm: 'Mega Match', icon: '💥', thumb: ['#9b59b6', '#1a0c2a'], cover: COMING_SOON_COVERS['mega-match'], etaEn: 'Coming soon', etaAm: 'በቅርብ ቀን' },
  { id: 'ninja-dash', nameEn: 'Ninja Dash', nameAm: 'Ninja Dash', icon: '🥷', thumb: ['#2c3e50', '#0a1018'], cover: COMING_SOON_COVERS['ninja-dash'], etaEn: 'Coming soon', etaAm: 'በቅርብ ቀን' },
];

export const CATEGORY_CHIPS: { id: GameCategory | 'all'; icon: string; labelEn: string; labelAm: string }[] = [
  { id: 'all', icon: '🎮', labelEn: 'All', labelAm: 'ሁሉም' },
  { id: 'puzzle', icon: '🧩', labelEn: 'Puzzle', labelAm: 'እንቆቅልሽ' },
  { id: 'arcade', icon: '👾', labelEn: 'Arcade', labelAm: 'አርኬድ' },
  { id: 'brain', icon: '🧠', labelEn: 'Brain', labelAm: 'አእምሮ' },
  { id: 'action', icon: '⚡', labelEn: 'Action', labelAm: 'እርምጃ' },
  { id: 'trivia', icon: '❓', labelEn: 'Trivia', labelAm: 'ጥያቄ' },
  { id: 'tournament', icon: '🏆', labelEn: 'Tournament', labelAm: 'ውድድር' },
  { id: 'kids', icon: '👶', labelEn: 'Kids', labelAm: 'ልጆች' },
];

/** Browse dropdown options — excludes tournament (those live under the Tournament tab). */
export const FREE_BROWSE_CATEGORIES: { id: GameCategory; icon: string; labelEn: string; labelAm: string }[] =
  CATEGORY_CHIPS.filter((c): c is { id: GameCategory; icon: string; labelEn: string; labelAm: string } =>
    c.id !== 'all' && c.id !== 'tournament' && c.id !== 'kids' && c.id !== 'sports');

const TRENDING_IDS = [
  'temple-dash', 'fruit-slice', 'memory-match', 'bubble-pop', 'popblast',
  'orbit-blast', 'ethiopian-quiz', 'merge-2048',
];

const RECENT_IDS = [
  'race-car', 'slide-puzzle', 'arrow-shot', 'ball-maze', 'pipe-connect', 'rope-rescue',
];

const EST_MINUTES: Record<string, number> = {
  'ethiopian-quiz': 3, 'sudoku': 5, 'spell': 3, 'vocab': 3, 'memory-match': 4,
  'fruit-slice': 2, 'temple-dash': 2, 'merge-2048': 4, 'tower-defense': 8,
};
const DEFAULT_EST_MINUTES = 2;

/** Resolve category from genre — never returns tournament (free-games browse only). */
function deriveCategoryFromGenre(g: GameMeta): GameCategory {
  const g0 = g.genreEn.toLowerCase();
  if (g0.includes('puzzle') || g0.includes('match-3') || g0.includes('match')) return 'puzzle';
  if (g0.includes('brain') || g0.includes('logic') || g0.includes('math')) return 'brain';
  if (g0.includes('trivia') || g0.includes('word') || g0.includes('spelling') || g0.includes('vocabulary') || g0.includes('rhyme')) return 'trivia';
  if (g0.includes('runner') || g0.includes('shooter') || g0.includes('skill') || g0.includes('reflex')
    || g0.includes('racing') || g0.includes('platform') || g0.includes('maze') || g0.includes('strategy')
    || g0.includes('physics')) return 'action';
  if (g0.includes('sport')) return 'sports';
  if (g0.includes('kids')) return 'kids';
  return 'arcade';
}

/** Resolve a game's hub category from explicit metadata or its genre label. */
export function gameCategory(g: GameMeta): GameCategory {
  if (g.category) return g.category;
  if (g.mode === 'tournament') return 'tournament';
  return deriveCategoryFromGenre(g);
}

/** Category for free-games browse — tournament tab uses mode filter instead. */
export function freeGameCategory(g: GameMeta): GameCategory {
  if (g.category) return g.category;
  return deriveCategoryFromGenre(g);
}

/** Categories that have at least one free game (for dropdown; no empty shelves). */
export function activeFreeCategories(): typeof FREE_BROWSE_CATEGORIES {
  const counts = new Map<GameCategory, number>();
  for (const g of CATALOG) {
    if (g.mode !== 'free') continue;
    const c = freeGameCategory(g);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return FREE_BROWSE_CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0);
}

/** Free games in a browse category (tournament titles excluded). */
export function freeGamesInCategory(cat: GameCategory | 'all'): GameMeta[] {
  const free = orderedCatalog().filter((g) => g.mode === 'free');
  if (cat === 'all') return free;
  return free.filter((g) => freeGameCategory(g) === cat);
}

export function estMinutesFor(g: GameMeta): number {
  return g.estMinutes ?? EST_MINUTES[g.id] ?? DEFAULT_EST_MINUTES;
}

export function ratingFor(g: GameMeta): number {
  return g.rating ?? 4.5;
}

/** Horizontal-scroll trending row — analytics sort, portal override, or curated defaults. */
export function trendingGames(
  portalIds?: string[],
  playCounts?: Record<string, number>,
  mode?: 'curated' | 'analytics',
): GameMeta[] {
  const trendingMode = mode ?? 'curated';
  if (trendingMode === 'analytics' && playCounts && Object.keys(playCounts).length > 0) {
    return orderedCatalog()
      .slice()
      .sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0))
      .slice(0, 8);
  }
  const ids = portalIds?.length ? portalIds : TRENDING_IDS;
  const picked = ids.map((id) => getGame(id)).filter((g): g is GameMeta => !!g);
  if (picked.length >= 5) return picked.slice(0, 8);
  const extra = orderedCatalog().filter((g) => !ids.includes(g.id));
  return [...picked, ...extra].slice(0, 8);
}

/** Recently added shelf — portal override, then explicit addedAt, then curated fallbacks. */
export function recentlyAddedGames(portalIds?: string[]): GameMeta[] {
  const seedIds = portalIds?.length ? portalIds : RECENT_IDS;
  const withDate = CATALOG.filter((g) => g.addedAt)
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
  const curated = seedIds.map((id) => getGame(id)).filter((g): g is GameMeta => !!g);
  const seen = new Set<string>();
  const out: GameMeta[] = [];
  for (const g of [...withDate, ...curated, ...orderedCatalog()]) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
    if (out.length >= 8) break;
  }
  return out;
}

/** Filter the storefront by hub category chip. */
export function gamesInCategory(cat: GameCategory | 'all'): GameMeta[] {
  if (cat === 'all') return orderedCatalog();
  return orderedCatalog().filter((g) => gameCategory(g) === cat);
}

// Portal card defaults — attached after catalog assembly.
const BADGE_HOT = new Set(['fruit-slice', 'memory-match', 'temple-dash']);
const BADGE_NEW = new Set(RECENT_IDS);
for (const g of CATALOG) {
  if (!g.badge) {
    if (BADGE_HOT.has(g.id)) g.badge = 'hot';
    else if (BADGE_NEW.has(g.id)) g.badge = 'new';
  }
  if (!g.rating) g.rating = ratingFor(g);
  if (!g.estMinutes) g.estMinutes = estMinutesFor(g);
  if (g.mode === 'free' && !g.category) g.category = freeGameCategory(g);
}
for (const id of RECENT_IDS) {
  const g = getGame(id);
  if (g && !g.addedAt) g.addedAt = '2026-06-01';
}
