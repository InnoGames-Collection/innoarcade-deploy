// Question banks for the native LexiQuest brain & word games. Ported verbatim
// from the retired vendored app (public/lexiquest/js/data) so the games play
// identically — now as first-class TS modules in the GoPlay catalog.

export interface VocabItem { q: string; a: string; wrong: string[]; d: number; }
export interface SpellItem { def: string; a: string; wrong: string[]; }
export interface RhymeItem { clue: string; w1: string; w2: string; }
export interface LogicItem { q: string; a: string; wrong: string[]; why: string; }

// Vocabulary Strength — MCQ, difficulty 1 (easy) → 5 (hard).
export const VOCAB: VocabItem[] = [
  { q: 'happy', a: 'feeling pleasure or joy', wrong: ['feeling sleepy', 'moving quickly', 'very large'], d: 1 },
  { q: 'rapid', a: 'very fast', wrong: ['very loud', 'very cold', 'very honest'], d: 1 },
  { q: 'fragile', a: 'easily broken', wrong: ['pleasant smelling', 'brightly colored', 'extremely heavy'], d: 1 },
  { q: 'vacant', a: 'empty; not occupied', wrong: ['on vacation', 'very clean', 'newly built'], d: 1 },
  { q: 'drowsy', a: 'sleepy', wrong: ['damp', 'dizzy', 'grumpy'], d: 1 },
  { q: 'abundant', a: 'existing in large quantities', wrong: ['completely missing', 'left behind', 'very valuable'], d: 2 },
  { q: 'candid', a: 'honest and direct', wrong: ['sugary sweet', 'secretly planned', 'photogenic'], d: 2 },
  { q: 'diligent', a: 'showing steady, careful effort', wrong: ['easily distracted', 'delicately built', 'slow to anger'], d: 2 },
  { q: 'hostile', a: 'unfriendly or antagonistic', wrong: ['welcoming', 'related to hospitals', 'easily frightened'], d: 2 },
  { q: 'novice', a: 'a beginner', wrong: ['a short story', 'an expert', 'a new idea'], d: 2 },
  { q: 'frugal', a: 'careful about spending money', wrong: ['full of fruit', 'easily angered', 'generous to a fault'], d: 3 },
  { q: 'lucid', a: 'clear and easy to understand', wrong: ['glowing in the dark', 'slippery', 'dreamlike and confused'], d: 3 },
  { q: 'tenacious', a: 'holding on firmly; persistent', wrong: ['having ten parts', 'easily persuaded', 'quick to let go'], d: 3 },
  { q: 'benevolent', a: 'kind and generous', wrong: ['violently angry', 'well organized', 'extremely lucky'], d: 3 },
  { q: 'prudent', a: 'acting with care and good judgment', wrong: ['overly proud', 'rude and abrupt', 'reckless'], d: 3 },
  { q: 'ephemeral', a: 'lasting a very short time', wrong: ['heavenly', 'extremely strong', 'found everywhere'], d: 4 },
  { q: 'gregarious', a: 'fond of company; sociable', wrong: ['enormous', 'greedy', 'easily startled'], d: 4 },
  { q: 'laconic', a: 'using very few words', wrong: ['milky in color', 'lacking energy', 'overly talkative'], d: 4 },
  { q: 'obfuscate', a: 'to make unclear or confusing', wrong: ['to apologize formally', 'to make obvious', 'to stuff full'], d: 4 },
  { q: 'intrepid', a: 'fearless and adventurous', wrong: ['trapped inside', 'deeply suspicious', 'quick to retreat'], d: 4 },
  { q: 'perspicacious', a: 'having keen insight', wrong: ['sweating heavily', 'extremely stubborn', 'speaking persuasively'], d: 5 },
  { q: 'pulchritude', a: 'physical beauty', wrong: ['rotten smell', 'moral courage', 'great wealth'], d: 5 },
  { q: 'sesquipedalian', a: 'given to using long words', wrong: ['having six legs', 'one and a half centuries old', 'riding on horseback'], d: 5 },
  { q: 'ineffable', a: 'too great to be expressed in words', wrong: ['impossible to remove', 'lacking effort', 'unable to be heard'], d: 5 },
  { q: 'recalcitrant', a: 'stubbornly resistant to authority', wrong: ['recently calculated', 'easily molded', 'deeply remorseful'], d: 5 },
];

// Spell Check — definition + one correct spelling among misspellings.
export const SPELL: SpellItem[] = [
  { def: 'To provide lodging or make room for', a: 'accommodate', wrong: ['accomodate', 'acommodate', 'accommadate'] },
  { def: 'Something that happens; an instance of occurring', a: 'occurrence', wrong: ['occurence', 'ocurrence', 'occurrance'] },
  { def: 'To make someone feel awkward or ashamed', a: 'embarrass', wrong: ['embarass', 'embarras', 'emberrass'] },
  { def: 'Your inner sense of right and wrong', a: 'conscience', wrong: ['concience', 'conscence', 'consciense'] },
  { def: 'A strong, regular repeated pattern of sound', a: 'rhythm', wrong: ['rythm', 'rythym', 'rhythym'] },
  { def: 'A period of one thousand years', a: 'millennium', wrong: ['millenium', 'milennium', 'millennum'] },
  { def: 'Required; essential', a: 'necessary', wrong: ['neccessary', 'necesary', 'neccesary'] },
  { def: 'Apart from others; distinct', a: 'separate', wrong: ['seperate', 'separete', 'seperete'] },
  { def: 'Without doubt; certainly', a: 'definitely', wrong: ['definately', 'definitly', 'definatly'] },
  { def: 'The work of keeping something in good condition', a: 'maintenance', wrong: ['maintainance', 'maintenence', 'maintanance'] },
  { def: 'A special right or advantage', a: 'privilege', wrong: ['priviledge', 'privelege', 'privilage'] },
  { def: 'A set of written questions for gathering information', a: 'questionnaire', wrong: ['questionaire', 'questionnair', 'questionairre'] },
  { def: 'To suggest as worthy or suitable', a: 'recommend', wrong: ['reccommend', 'recomend', 'reccomend'] },
  { def: 'A place where meals are served to customers', a: 'restaurant', wrong: ['restaraunt', 'resteraunt', 'restuarant'] },
  { def: 'A space entirely devoid of matter', a: 'vacuum', wrong: ['vaccum', 'vacume', 'vaccuum'] },
  { def: 'Strange or unusual', a: 'weird', wrong: ['wierd', 'weerd', 'wierd '] },
  { def: 'A chart showing days, weeks, and months', a: 'calendar', wrong: ['calender', 'calandar', 'calandr'] },
  { def: 'Existing or happening now and then', a: 'occasionally', wrong: ['occassionally', 'ocassionally', 'occasionaly'] },
  { def: 'A person who communicates between groups', a: 'liaison', wrong: ['liason', 'liasion', 'laison'] },
  { def: 'The state of being aware; not asleep', a: 'conscious', wrong: ['concious', 'consious', 'conscius'] },
];

// Rhyme Twins — clue → two rhyming words.
export const RHYME: RhymeItem[] = [
  { clue: 'An overweight house pet', w1: 'fat', w2: 'cat' },
  { clue: 'An unhappy father', w1: 'sad', w2: 'dad' },
  { clue: 'A humorous rabbit', w1: 'funny', w2: 'bunny' },
  { clue: 'A soaked canine', w1: 'soggy', w2: 'doggy' },
  { clue: 'A noisy group of people', w1: 'loud', w2: 'crowd' },
  { clue: 'An evening meal for a champion', w1: 'winner', w2: 'dinner' },
  { clue: 'A fortunate small duck', w1: 'lucky', w2: 'ducky' },
  { clue: 'A clever feline', w1: 'witty', w2: 'kitty' },
  { clue: 'A home for a rodent', w1: 'mouse', w2: 'house' },
  { clue: 'An untamed young horse', w1: 'wild', w2: 'child' },
  { clue: 'A simple-to-read sign by the road', w1: 'plain', w2: 'lane' },
  { clue: 'A speedy explosion', w1: 'fast', w2: 'blast' },
  { clue: 'A pleasant frozen treat', w1: 'nice', w2: 'ice' },
  { clue: 'A counterfeit serpent', w1: 'fake', w2: 'snake' },
  { clue: 'A big hairless animal that loves honey', w1: 'bare', w2: 'bear' },
  { clue: "A bright-colored amphibian's wooden seat", w1: 'frog', w2: 'log' },
  { clue: 'A late-night call from a bird of prey', w1: 'owl', w2: 'howl' },
  { clue: 'Genuine rice or wheat dish', w1: 'real', w2: 'meal' },
];

// Logic Riddles — short deduction puzzles (the obvious answer is often the trap).
export const LOGIC: LogicItem[] = [
  { q: 'Ana is taller than Ben. Ben is taller than Carl. Who is shortest?', a: 'Carl', wrong: ['Ana', 'Ben', 'Cannot tell'], why: 'Ana > Ben > Carl, so Carl is shortest.' },
  { q: 'All roses in this shop are red. Maya bought a flower here that is not red. What can we conclude?', a: 'It is not a rose', wrong: ['It is a rose', 'It is red after all', 'Nothing at all'], why: 'If every rose is red, a non-red flower cannot be a rose.' },
  { q: 'A race has no ties. Dawit finished before Sara but after Marta. Who came first of the three?', a: 'Marta', wrong: ['Dawit', 'Sara', 'Cannot tell'], why: 'Marta beat Dawit, who beat Sara.' },
  { q: 'Two days ago was Saturday. What day is tomorrow?', a: 'Tuesday', wrong: ['Monday', 'Wednesday', 'Sunday'], why: 'Two days after Saturday is Monday (today), so tomorrow is Tuesday.' },
  { q: 'Every glof is a trab. Some trabs are blue. Which statement MUST be true?', a: 'Every glof is a trab', wrong: ['Some glofs are blue', 'All trabs are glofs', 'No glof is blue'], why: 'Only the first statement is guaranteed; the blue trabs might not be glofs.' },
  { q: 'A farmer has 17 sheep. All but 9 run away. How many remain?', a: '9', wrong: ['8', '17', '0'], why: '“All but 9” means 9 stay.' },
  { q: 'If it rains, the path is wet. The path is wet. What follows?', a: 'Nothing certain', wrong: ['It rained', "It didn't rain", 'The path is dry'], why: 'A wet path could have other causes — affirming the consequent is a trap.' },
  { q: 'Lia is older than Tom. Tom is older than Zoe. Zoe is older than Kim. Who is second-youngest?', a: 'Zoe', wrong: ['Tom', 'Kim', 'Lia'], why: 'Order: Lia > Tom > Zoe > Kim, so Zoe is second-youngest.' },
  { q: 'A box weighs 10 kg plus half its own weight. How much does it weigh?', a: '20 kg', wrong: ['15 kg', '10 kg', '30 kg'], why: 'W = 10 + W/2 → W/2 = 10 → W = 20.' },
  { q: 'In a class, everyone plays chess or checkers (or both). 15 play chess, 12 play checkers, 5 play both. How many students?', a: '22', wrong: ['27', '17', '32'], why: '15 + 12 − 5 = 22 (don’t double-count the overlap).' },
  { q: 'A is east of B. C is west of B. Where is C relative to A?', a: 'West', wrong: ['East', 'North', 'Cannot tell'], why: 'C is west of B, which is west of A — so C is west of A.' },
  { q: 'Which weighs more: a kilogram of feathers or a kilogram of bricks?', a: 'They weigh the same', wrong: ['The bricks', 'The feathers', 'Depends on humidity'], why: 'A kilogram is a kilogram.' },
  { q: 'Five people shake hands with each other exactly once. How many handshakes?', a: '10', wrong: ['20', '25', '5'], why: '5×4 ÷ 2 = 10 — each handshake involves two people.' },
  { q: 'Tomorrow is neither Wednesday nor Thursday. Yesterday was not Friday. Today is not Monday. Today could be a weekend day. Which day fits all clues?', a: 'Sunday', wrong: ['Saturday', 'Tuesday', 'Friday'], why: 'Saturday fails (yesterday Friday); Sunday passes every clue.' },
];
