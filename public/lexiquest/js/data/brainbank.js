/* Hand-authored analytical question banks for LexiQuest. */
window.LQ_DATA = window.LQ_DATA || {};

/* ---- Odd One Out: 4 items, one doesn't belong ---- */
LQ_DATA.ODDONE = [
  { odd: "carrot", rest: ["apple", "banana", "mango"], why: "A carrot is a vegetable; the others are fruits." },
  { odd: "spider", rest: ["ant", "beetle", "wasp"], why: "A spider has eight legs; insects have six." },
  { odd: "Mercury", rest: ["Sirius", "Vega", "Polaris"], why: "Mercury is a planet; the others are stars." },
  { odd: "trumpet", rest: ["violin", "cello", "harp"], why: "A trumpet is brass; the others are string instruments." },
  { odd: "whale", rest: ["shark", "tuna", "salmon"], why: "A whale is a mammal; the others are fish." },
  { odd: "square", rest: ["circle", "ellipse", "oval"], why: "A square has corners; the others are curved." },
  { odd: "copper", rest: ["oak", "pine", "cedar"], why: "Copper is a metal; the others are trees." },
  { odd: "sandal", rest: ["beret", "fedora", "helmet"], why: "A sandal goes on your feet; the others on your head." },
  { odd: "lake", rest: ["river", "stream", "creek"], why: "A lake is still water; the others flow." },
  { odd: "seventeen", rest: ["sixteen", "twenty", "eight"], why: "Seventeen is odd; the others are even." },
  { odd: "novel", rest: ["haiku", "sonnet", "limerick"], why: "A novel is prose; the others are poems." },
  { odd: "kayak", rest: ["truck", "bicycle", "train"], why: "A kayak travels on water; the others on land." },
  { odd: "thumb", rest: ["knee", "elbow", "ankle"], why: "A thumb is not a joint of a limb; the others are." },
  { odd: "cheddar", rest: ["sourdough", "baguette", "ciabatta"], why: "Cheddar is cheese; the others are breads." },
  { odd: "Asia", rest: ["Brazil", "Kenya", "Canada"], why: "Asia is a continent; the others are countries." },
  { odd: "sphere", rest: ["triangle", "square", "pentagon"], why: "A sphere is a 3-D solid; the others are flat shapes." },
  { odd: "igloo", rest: ["castle", "skyscraper", "cathedral"], why: "An igloo is made of ice; the others of stone or steel." },
  { odd: "Saturn", rest: ["Mars", "Venus", "Mercury"], why: "Saturn is a gas giant; the others are rocky planets." },
  { odd: "tambourine", rest: ["flute", "clarinet", "oboe"], why: "A tambourine is percussion; the others are woodwind." },
  { odd: "glacier", rest: ["volcano", "geyser", "hot spring"], why: "A glacier is cold; the others are driven by heat." },
];

/* ---- Logic Riddles: short deduction puzzles ---- */
LQ_DATA.LOGIC = [
  { q: "Ana is taller than Ben. Ben is taller than Carl. Who is shortest?", a: "Carl", wrong: ["Ana", "Ben", "Cannot tell"], why: "Ana > Ben > Carl, so Carl is shortest." },
  { q: "All roses in this shop are red. Maya bought a flower here that is not red. What can we conclude?", a: "It is not a rose", wrong: ["It is a rose", "It is red after all", "Nothing at all"], why: "If every rose is red, a non-red flower cannot be a rose." },
  { q: "A race has no ties. Dawit finished before Sara but after Marta. Who came first of the three?", a: "Marta", wrong: ["Dawit", "Sara", "Cannot tell"], why: "Marta beat Dawit, who beat Sara." },
  { q: "Two days ago was Saturday. What day is tomorrow?", a: "Tuesday", wrong: ["Monday", "Wednesday", "Sunday"], why: "Two days after Saturday is Monday (today), so tomorrow is Tuesday." },
  { q: "Every glof is a trab. Some trabs are blue. Which statement MUST be true?", a: "Every glof is a trab", wrong: ["Some glofs are blue", "All trabs are glofs", "No glof is blue"], why: "Only the first statement is guaranteed; the blue trabs might not be glofs." },
  { q: "A farmer has 17 sheep. All but 9 run away. How many remain?", a: "9", wrong: ["8", "17", "0"], why: "“All but 9” means 9 stay." },
  { q: "If it rains, the path is wet. The path is wet. What follows?", a: "Nothing certain", wrong: ["It rained", "It didn't rain", "The path is dry"], why: "A wet path could have other causes — affirming the consequent is a trap." },
  { q: "Lia is older than Tom. Tom is older than Zoe. Zoe is older than Kim. Who is second-youngest?", a: "Zoe", wrong: ["Tom", "Kim", "Lia"], why: "Order: Lia > Tom > Zoe > Kim, so Zoe is second-youngest." },
  { q: "A box weighs 10 kg plus half its own weight. How much does it weigh?", a: "20 kg", wrong: ["15 kg", "10 kg", "30 kg"], why: "W = 10 + W/2 → W/2 = 10 → W = 20." },
  { q: "Yesterday I was 25. Next year I'll turn 27. When is my birthday?", a: "December 31", wrong: ["January 1", "June 30", "Impossible"], why: "Said on Jan 1: yesterday (Dec 31) I was 25 and turned 26 that day; this year I turn 27? No — next calendar year I turn 27. It works only with a Dec 31 birthday." },
  { q: "Three switches, one lamp upstairs. You may flip switches freely but go upstairs once. How do you find the right switch?", a: "Use warmth: flip one on for a while, then off; flip a second on; check bulb", wrong: ["Flip all three at once", "It cannot be done", "Listen for a hum"], why: "Hot-but-off bulb = first switch, lit = second, cold and dark = third." },
  { q: "In a class, everyone plays chess or checkers (or both). 15 play chess, 12 play checkers, 5 play both. How many students?", a: "22", wrong: ["27", "17", "32"], why: "15 + 12 − 5 = 22 (don't double-count the overlap)." },
  { q: "A is east of B. C is west of B. Where is C relative to A?", a: "West", wrong: ["East", "North", "Cannot tell"], why: "C is west of B, which is west of A — so C is west of A." },
  { q: "Which weighs more: a kilogram of feathers or a kilogram of bricks?", a: "They weigh the same", wrong: ["The bricks", "The feathers", "Depends on humidity"], why: "A kilogram is a kilogram." },
  { q: "Five people shake hands with each other exactly once. How many handshakes?", a: "10", wrong: ["20", "25", "5"], why: "5×4 ÷ 2 = 10 — each handshake involves two people." },
  { q: "Tomorrow is neither Wednesday nor Thursday. Yesterday was not Friday. Today is not Monday. Today could be a weekend day. Which day fits all clues?", a: "Sunday", wrong: ["Saturday", "Tuesday", "Friday"], why: "Saturday fails (yesterday Friday); Sunday passes every clue." },
];
