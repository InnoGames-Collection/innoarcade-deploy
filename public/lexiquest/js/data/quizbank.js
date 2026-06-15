/* Hand-authored question banks for LexiQuest quiz games. */
window.LQ_DATA = window.LQ_DATA || {};

/* ---- Missing Letter: each set's missing letters spell the secret word ---- */
LQ_DATA.MISSING = [
  {
    secret: "BLOOM",
    rounds: [
      { word: "number", blank: 3, clue: "A quantity expressed in digits" },
      { word: "yellow", blank: 2, clue: "The color of lemons and school buses" },
      { word: "echo", blank: 3, clue: "A sound that bounces back to you" },
      { word: "piano", blank: 4, clue: "A keyboard instrument with 88 keys" },
      { word: "hammer", blank: 3, clue: "A tool for driving nails" },
    ],
  },
  {
    secret: "WORDS",
    rounds: [
      { word: "answer", blank: 3, clue: "What you give to a question" },
      { word: "carbon", blank: 4, clue: "The element all known life is based on" },
      { word: "mirror", blank: 2, clue: "It shows you your own reflection" },
      { word: "wonder", blank: 3, clue: "A feeling of amazement and curiosity" },
      { word: "whisper", blank: 3, clue: "To speak very softly" },
    ],
  },
  {
    secret: "GAMES",
    rounds: [
      { word: "jungle", blank: 3, clue: "A dense tropical forest" },
      { word: "organ", blank: 3, clue: "A pipe instrument heard in cathedrals" },
      { word: "grammar", blank: 3, clue: "The rules for putting words together" },
      { word: "screen", blank: 4, clue: "What you are probably looking at right now" },
      { word: "episode", blank: 3, clue: "One installment of a TV series" },
    ],
  },
  {
    secret: "QUILL",
    rounds: [
      { word: "banquet", blank: 3, clue: "A grand formal dinner" },
      { word: "vacuum", blank: 3, clue: "A space completely empty of matter" },
      { word: "violin", blank: 4, clue: "A string instrument played with a bow" },
      { word: "island", blank: 2, clue: "Land surrounded entirely by water" },
      { word: "umbrella", blank: 5, clue: "Carry it when rain is forecast" },
    ],
  },
];

/* ---- Vocabulary Strength: MCQ, difficulty 1 (easy) - 5 (hard) ---- */
LQ_DATA.VOCAB = [
  { q: "happy", a: "feeling pleasure or joy", wrong: ["feeling sleepy", "moving quickly", "very large"], d: 1 },
  { q: "rapid", a: "very fast", wrong: ["very loud", "very cold", "very honest"], d: 1 },
  { q: "fragile", a: "easily broken", wrong: ["pleasant smelling", "brightly colored", "extremely heavy"], d: 1 },
  { q: "vacant", a: "empty; not occupied", wrong: ["on vacation", "very clean", "newly built"], d: 1 },
  { q: "drowsy", a: "sleepy", wrong: ["damp", "dizzy", "grumpy"], d: 1 },
  { q: "abundant", a: "existing in large quantities", wrong: ["completely missing", "left behind", "very valuable"], d: 2 },
  { q: "candid", a: "honest and direct", wrong: ["sugary sweet", "secretly planned", "photogenic"], d: 2 },
  { q: "diligent", a: "showing steady, careful effort", wrong: ["easily distracted", "delicately built", "slow to anger"], d: 2 },
  { q: "hostile", a: "unfriendly or antagonistic", wrong: ["welcoming", "related to hospitals", "easily frightened"], d: 2 },
  { q: "novice", a: "a beginner", wrong: ["a short story", "an expert", "a new idea"], d: 2 },
  { q: "frugal", a: "careful about spending money", wrong: ["full of fruit", "easily angered", "generous to a fault"], d: 3 },
  { q: "lucid", a: "clear and easy to understand", wrong: ["glowing in the dark", "slippery", "dreamlike and confused"], d: 3 },
  { q: "tenacious", a: "holding on firmly; persistent", wrong: ["having ten parts", "easily persuaded", "quick to let go"], d: 3 },
  { q: "benevolent", a: "kind and generous", wrong: ["violently angry", "well organized", "extremely lucky"], d: 3 },
  { q: "prudent", a: "acting with care and good judgment", wrong: ["overly proud", "rude and abrupt", "reckless"], d: 3 },
  { q: "ephemeral", a: "lasting a very short time", wrong: ["heavenly", "extremely strong", "found everywhere"], d: 4 },
  { q: "gregarious", a: "fond of company; sociable", wrong: ["enormous", "greedy", "easily startled"], d: 4 },
  { q: "laconic", a: "using very few words", wrong: ["milky in color", "lacking energy", "overly talkative"], d: 4 },
  { q: "obfuscate", a: "to make unclear or confusing", wrong: ["to apologize formally", "to make obvious", "to stuff full"], d: 4 },
  { q: "intrepid", a: "fearless and adventurous", wrong: ["trapped inside", "deeply suspicious", "quick to retreat"], d: 4 },
  { q: "perspicacious", a: "having keen insight", wrong: ["sweating heavily", "extremely stubborn", "speaking persuasively"], d: 5 },
  { q: "pulchritude", a: "physical beauty", wrong: ["rotten smell", "moral courage", "great wealth"], d: 5 },
  { q: "sesquipedalian", a: "given to using long words", wrong: ["having six legs", "one and a half centuries old", "riding on horseback"], d: 5 },
  { q: "ineffable", a: "too great to be expressed in words", wrong: ["impossible to remove", "lacking effort", "unable to be heard"], d: 5 },
  { q: "recalcitrant", a: "stubbornly resistant to authority", wrong: ["recently calculated", "easily molded", "deeply remorseful"], d: 5 },
];

/* ---- Name That Thing: emoji + correct precise word ---- */
LQ_DATA.THING = [
  { emoji: "⚓", a: "anchor", wrong: ["grapnel", "gaff", "cleat"] },
  { emoji: "🪗", a: "accordion", wrong: ["concertina", "hurdy-gurdy", "bandoneon"] },
  { emoji: "🏺", a: "amphora", wrong: ["tureen", "carafe", "crucible"] },
  { emoji: "🪓", a: "hatchet", wrong: ["adze", "scythe", "awl"] },
  { emoji: "🧭", a: "compass", wrong: ["sextant", "astrolabe", "theodolite"] },
  { emoji: "🩺", a: "stethoscope", wrong: ["otoscope", "sphygmomanometer", "speculum"] },
  { emoji: "🔭", a: "telescope", wrong: ["periscope", "kaleidoscope", "microscope"] },
  { emoji: "⛲", a: "fountain", wrong: ["cistern", "aqueduct", "spillway"] },
  { emoji: "🛖", a: "hut", wrong: ["yurt", "gazebo", "portico"] },
  { emoji: "🪕", a: "banjo", wrong: ["mandolin", "ukulele", "zither"] },
  { emoji: "🏰", a: "castle", wrong: ["citadel", "rampart", "bastion"] },
  { emoji: "🪜", a: "ladder", wrong: ["trellis", "scaffold", "stile"] },
  { emoji: "🕰️", a: "mantel clock", wrong: ["sundial", "chronometer", "metronome"] },
  { emoji: "🫖", a: "teapot", wrong: ["samovar", "ewer", "decanter"] },
  { emoji: "🛶", a: "canoe", wrong: ["coracle", "skiff", "dinghy"] },
  { emoji: "🎻", a: "violin", wrong: ["viola", "cello", "lute"] },
  { emoji: "🪤", a: "mousetrap", wrong: ["snare", "gin trap", "deadfall"] },
  { emoji: "⛏️", a: "pickaxe", wrong: ["mattock", "trowel", "auger"] },
  { emoji: "🎠", a: "carousel horse", wrong: ["hobbyhorse", "rocking horse", "destrier"] },
  { emoji: "🪝", a: "hook", wrong: ["clasp", "hasp", "ferrule"] },
];

/* ---- Spell It: definition + one correct spelling among misspellings ---- */
LQ_DATA.SPELL = [
  { def: "To provide lodging or make room for", a: "accommodate", wrong: ["accomodate", "acommodate", "accommadate"] },
  { def: "Something that happens; an instance of occurring", a: "occurrence", wrong: ["occurence", "ocurrence", "occurrance"] },
  { def: "To make someone feel awkward or ashamed", a: "embarrass", wrong: ["embarass", "embarras", "emberrass"] },
  { def: "Your inner sense of right and wrong", a: "conscience", wrong: ["concience", "conscence", "consciense"] },
  { def: "A strong, regular repeated pattern of sound", a: "rhythm", wrong: ["rythm", "rythym", "rhythym"] },
  { def: "A period of one thousand years", a: "millennium", wrong: ["millenium", "milennium", "millennium "] },
  { def: "Required; essential", a: "necessary", wrong: ["neccessary", "necesary", "neccesary"] },
  { def: "Apart from others; distinct", a: "separate", wrong: ["seperate", "separete", "seperete"] },
  { def: "Without doubt; certainly", a: "definitely", wrong: ["definately", "definitly", "definatly"] },
  { def: "The work of keeping something in good condition", a: "maintenance", wrong: ["maintainance", "maintenence", "maintanance"] },
  { def: "A special right or advantage", a: "privilege", wrong: ["priviledge", "privelege", "privilage"] },
  { def: "A set of written questions for gathering information", a: "questionnaire", wrong: ["questionaire", "questionnair", "questionairre"] },
  { def: "To suggest as worthy or suitable", a: "recommend", wrong: ["reccommend", "recomend", "reccomend"] },
  { def: "A place where meals are served to customers", a: "restaurant", wrong: ["restaraunt", "resteraunt", "restuarant"] },
  { def: "A space entirely devoid of matter", a: "vacuum", wrong: ["vaccum", "vacume", "vaccuum"] },
  { def: "Strange or unusual", a: "weird", wrong: ["wierd", "weerd", "wired "] },
  { def: "A chart showing days, weeks, and months", a: "calendar", wrong: ["calender", "calandar", "calender "] },
  { def: "Existing or happening now and then", a: "occasionally", wrong: ["occassionally", "ocassionally", "occasionaly"] },
  { def: "A person who communicates between groups", a: "liaison", wrong: ["liason", "liasion", "laison"] },
  { def: "The state of being aware; not asleep", a: "conscious", wrong: ["concious", "consious", "conscius"] },
];

/* ---- True or False: word fact statements ---- */
LQ_DATA.TF = [
  { s: "“Bibliophile” means a lover of books.", t: true, why: "From Greek biblion (book) + philos (loving)." },
  { s: "“Nocturnal” describes animals active during the day.", t: false, why: "Nocturnal animals are active at night; daytime animals are diurnal." },
  { s: "“Verbose” means using more words than needed.", t: true, why: "A verbose writer is wordy." },
  { s: "“Arid” means extremely wet.", t: false, why: "Arid means very dry, like a desert." },
  { s: "A “cygnet” is a baby swan.", t: true, why: "Just as a duckling is a baby duck." },
  { s: "“Gregarious” means preferring to be alone.", t: false, why: "Gregarious people are sociable; loners are solitary." },
  { s: "“Antipathy” is a strong feeling of dislike.", t: true, why: "Anti- (against) + pathos (feeling)." },
  { s: "If something is “tepid,” it is boiling hot.", t: false, why: "Tepid means lukewarm — only slightly warm." },
  { s: "An “octogenarian” is a person in their eighties.", t: true, why: "From Latin octoginta, eighty." },
  { s: "“Famished” means completely full after a meal.", t: false, why: "Famished means extremely hungry." },
  { s: "“Loquacious” means very talkative.", t: true, why: "From Latin loqui, to speak." },
  { s: "A “philatelist” collects coins.", t: false, why: "A philatelist collects stamps; a numismatist collects coins." },
  { s: "“Ubiquitous” means seeming to be everywhere at once.", t: true, why: "From Latin ubique, everywhere." },
  { s: "“Diminutive” means extremely large.", t: false, why: "Diminutive means very small." },
  { s: "To “procrastinate” is to delay doing something.", t: true, why: "From Latin cras, tomorrow — putting things off until tomorrow." },
  { s: "“Audible” means able to be seen.", t: false, why: "Audible means able to be heard; visible means able to be seen." },
  { s: "A “quandary” is a state of uncertainty about what to do.", t: true, why: "Being in a quandary means facing a dilemma." },
  { s: "“Benign” describes something harmful and dangerous.", t: false, why: "Benign means gentle or harmless — the opposite of malignant." },
  { s: "“Pristine” means in perfect, unspoiled condition.", t: true, why: "A pristine beach is clean and untouched." },
  { s: "An “epilogue” comes at the beginning of a book.", t: false, why: "An epilogue ends a book; a prologue begins it." },
  { s: "“Frigid” means intensely cold.", t: true, why: "From Latin frigidus, cold." },
  { s: "A “maelstrom” is a gentle summer breeze.", t: false, why: "A maelstrom is a violent whirlpool or turbulent situation." },
  { s: "“Ravenous” means extremely hungry.", t: true, why: "A ravenous appetite devours everything." },
  { s: "“Obsolete” means brand new and cutting-edge.", t: false, why: "Obsolete means no longer in use or out of date." },
];

/* ---- Rhyme Twins: clue -> two rhyming words ---- */
LQ_DATA.RHYME = [
  { clue: "An overweight house pet", w1: "fat", w2: "cat" },
  { clue: "An unhappy father", w1: "sad", w2: "dad" },
  { clue: "A humorous rabbit", w1: "funny", w2: "bunny" },
  { clue: "A soaked canine", w1: "soggy", w2: "doggy" },
  { clue: "A noisy group of people", w1: "loud", w2: "crowd" },
  { clue: "An evening meal for a champion", w1: "winner", w2: "dinner" },
  { clue: "A fortunate small duck", w1: "lucky", w2: "ducky" },
  { clue: "A clever feline", w1: "witty", w2: "kitty" },
  { clue: "A home for a rodent", w1: "mouse", w2: "house" },
  { clue: "An untamed young horse", w1: "wild", w2: "child" },
  { clue: "A simple-to-read sign by the road", w1: "plain", w2: "lane" },
  { clue: "A speedy explosion", w1: "fast", w2: "blast" },
  { clue: "A pleasant frozen treat", w1: "nice", w2: "ice" },
  { clue: "A counterfeit serpent", w1: "fake", w2: "snake" },
  { clue: "A big hairless animal that loves honey", w1: "bare", w2: "bear" },
  { clue: "A bright-colored amphibian's wooden seat", w1: "frog", w2: "log" },
  { clue: "A late-night phone call from a bird of prey", w1: "owl", w2: "howl" },
  { clue: "Genuine rice or wheat dish", w1: "real", w2: "meal" },
];
