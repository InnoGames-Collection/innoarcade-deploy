// Numbered "How to play" copy for hub card ℹ️ modals (EN + AM).

export interface HowToGuide {
  goalEn: string;
  goalAm: string;
  stepsEn: string[];
  stepsAm: string[];
}

export const HOWTO_GUIDES: Record<string, HowToGuide> = {
  'popblast': {
    goalEn: 'Match candies before your moves run out.',
    goalAm: 'እንቅስቃሴዎች ከመጨረሻቸው በፊት ከረሜላዎችን ያዛምዱ።',
    stepsEn: [
      'Tap Play, then tap two neighbouring candies to swap them.',
      'Line up 3 or more of the same colour in a row or column.',
      'Matched candies clear and new ones fall in — chain combos for bigger scores.',
      'Keep matching until you run out of moves or beat your best score.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ሁለት ጎረቤት ከረሜላዎችን ለመቀየር ይጫኑ።',
      '3+ ተመሳሳይ ቀለም በረድፍ ወይም በአምድ ያስተካክሉ።',
      'የተዛመዱ ከረሜላዎች ይጠፋሉ — ተከታታይ ግጥሚያዎች ትልቅ ነጥብ ይሰጣሉ።',
      'እንቅስቃሴዎች እስከሚያልቁ ወይም ምርጥ ነጥብዎን እስከሚያሻሽሉ ይቀጥሉ።',
    ],
  },
  'luckyslot': {
    goalEn: 'Spin the reels and land matching symbols.',
    goalAm: 'ሪሎችን ያሽከርክሩ ተመሳሳይ ምልክቶችን ያግኙ።',
    stepsEn: [
      'Tap Play, then tap Spin.',
      'Watch the three reels stop — matching symbols across the payline win points.',
      'Each spin counts as one round; higher combos pay more.',
      'Try to beat your best total before you leave.',
    ],
    stepsAm: [
      'Play ይንኩ፣ Spin ይንኩ።',
      'ሦስቱ ሪሎች ሲያቆሙ ተመሳሳይ ምልክቶች ነጥብ ይሰጣሉ።',
      'እያንዳንዱ Spin አንድ ዙር ነው።',
      'ከመውጣትዎ በፊት ምርጥ ነጥብዎን ይሻሽሉ።',
    ],
  },
  'memory-match': {
    goalEn: 'Clear all pairs fast for the monthly tournament leaderboard.',
    goalAm: 'ለወርሃዊ ውድድር ጥንዶችን በፍጥነት ያጥፉ።',
    stepsEn: [
      'Enter the tournament from the hub, then tap Play.',
      'Tap any two face-down cards to flip them.',
      'If they match, both stay open; if not, they flip back.',
      'Clear every pair with as few moves and as little time as possible — your best score ranks for ETB prizes.',
    ],
    stepsAm: [
      'ከሃብ ውድድሩን ይግቡ፣ Play ይንኩ።',
      'ሁለት ካርዶችን ይጫኑ።',
      'ተመሳሳይ ከሆኑ ይከፈታሉ፤ ካልሆኑ ይዘጋሉ።',
      'ሁሉንም ጥንዶች በትንሹ እንቅስቃሴ ያጥፉ — ምርጥ ነጥብዎ ለ ETB ይወዳደራል።',
    ],
  },
  'merge-2048': {
    goalEn: 'Merge tiles to reach 2048 and beyond.',
    goalAm: '2048 እና ከዚያም በላይ ለመድረስ ሰቆችን ይዋህዱ።',
    stepsEn: [
      'Swipe up, down, left, or right to slide all tiles.',
      'When two tiles with the same number touch, they merge into one doubled tile.',
      'Every swipe adds a new tile — plan ahead so the board does not fill up.',
      'Keep merging to reach 2048; higher tiles score more.',
    ],
    stepsAm: [
      'ሰቆችን ለማንሸራትት ይጥረጉ።',
      'እኩል ቁጥሮች ሲገናኙ ይደባለቃሉ።',
      'እያንዳንዱ ጥረጥረጥ አዲስ ሰብ ይጨምራል — ሰሌዳ እንዳይሞላ ይቅድሙ።',
      '2048 ለመድረስ ይቀጥሉ።',
    ],
  },
  'spin-wheel': {
    goalEn: 'Spin the wheel and land on a winning wedge.',
    goalAm: 'መንኮራኩሩን ያሽከርክሩ ሽልማት ላይ ያርፉ።',
    stepsEn: [
      'Tap Play, then tap the wheel to spin.',
      'Wait for it to stop — the wedge under the pointer is your result.',
      'Winning wedges add points to your score.',
      'Spin again to chase a higher total.',
    ],
    stepsAm: [
      'Play ይንኩ፣ መንኮራኩሩን ይንኩ።',
      'የሚያቆመው ቦታ ሽልማትዎን ይወስናል።',
      'አሸናፊ ክፍሎች ነጥብ ይጨምራሉ።',
      'ከፍተኛ ነጥብ ለማግኘት ይቀጥሉ።',
    ],
  },
  'ethiopian-quiz': {
    goalEn: 'Answer 5 Ethiopia trivia questions correctly.',
    goalAm: '5 የኢትዮጵያ ጥያቄዎችን በትክክል ይመልሱ።',
    stepsEn: [
      'Tap Play to start the quiz round.',
      'Read each multiple-choice question carefully.',
      'Tap one answer — you cannot change it after submitting.',
      'Get 3 or more correct to win points; finish all 5 for your final score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ጥያቄውን ያንብቡ።',
      'አንድ መልስ ይምረጡ።',
      '3+ ትክክለኛ መልስ ነጥብ ይሰጣል።',
    ],
  },
  'tap-game': {
    goalEn: 'Tap as many times as you can before time runs out.',
    goalAm: 'ጊዜ ከመጨረሱ በፊት ብዙ ይንኩ።',
    stepsEn: [
      'Tap Play — the countdown starts immediately.',
      'Tap the main button as fast and accurately as you can.',
      'Every valid tap adds to your score.',
      'When the timer hits zero, your total is submitted automatically.',
    ],
    stepsAm: [
      'Play ይንኩ — ጊዜ ይጀምራል።',
      'በፍጥነትና በትክክል ይንኩ።',
      'እያንዳንዱ ትክክለኛ መታ ነጥብ ይጨምራል።',
      'ጊዜ ሲያልቅ ነጥብዎ ይላካል።',
    ],
  },
  'lucky-box': {
    goalEn: 'Pick the lucky box with the best hidden reward.',
    goalAm: 'ምርጥ ሽልማት ያለበትን ሳጥን ይምረጡ።',
    stepsEn: [
      'Tap Play to see the row of closed boxes.',
      'Tap one box to reveal what is inside.',
      'Some boxes hold bonus points — others less.',
      'Your revealed prize becomes your round score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'አንድ ሳጥን ይምረጡ።',
      'አንዳንዶቹ ተጨማሪ ነጥብ አላቸው።',
      'የተገኘው ሽልማት ነጥብዎ ይሆናል።',
    ],
  },
  'temple-dash': {
    goalEn: 'Run as far as you can without hitting obstacles.',
    goalAm: 'እንቅፋቶች ሳይገናኙ ርቀት ይሂዱ።',
    stepsEn: [
      'Tap Play to start running.',
      'Swipe or tap lanes to jump, slide, or dodge obstacles.',
      'Collect coins along the track for bonus points.',
      'Crash ends the run — survive longer for a higher score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'እንቅፋቶችን ለማምለጥ ይዝለሉ ወይም ይንሸራተቱ።',
      'ሳንቲም ይሰብስቡ።',
      'ግድግዳ ከመጋጨት ዙሩ ይቋርጣል።',
    ],
  },
  'sudoku': {
    goalEn: 'Fill the grid with digits 1–9 with no repeats.',
    goalAm: '1–9 እንደገና ሳይደገሙ ሰንጠረዡን ይሙሉ።',
    stepsEn: [
      'Tap Play, then tap an empty cell to select it.',
      'Use the number pad to place a digit 1–9.',
      'Each row, column, and 3×3 box must contain every digit once.',
      'Complete the grid correctly to finish and score.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ባዶ ሰሌድ ይምረጡ።',
      '1–9 ከፓድ ይምረጡ።',
      'እያንዳንዱ ረድፍ፣ አምድ እና 3×3 ሳጥን 1–9 አንድ ጊዜ ብቻ።',
      'ትክክለኛ ሲሆን ያጠናቅቁ።',
    ],
  },
  'spell': {
    goalEn: 'Spell the hidden word from the clue.',
    goalAm: 'ከፍንጭ ቃሉን በፊደል ይጻፉ።',
    stepsEn: [
      'Tap Play and read the spelling clue.',
      'Tap letters on the keyboard to fill each slot.',
      'Use hints sparingly if you are stuck.',
      'Spell the full word correctly to win the round.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ፍንጭ ያንብቡ።',
      'ፊደሎችን ይጫኑ።',
      'ቃሉን ትክክለኛ ሲጽፉ ያሸንፋሉ።',
    ],
  },
  'vocab': {
    goalEn: 'Pick the correct meaning for each word.',
    goalAm: 'ለእያንዳንዱ ቃል ትክክለኛ ትርጉም ይምረጡ።',
    stepsEn: [
      'Tap Play to see the vocabulary word.',
      'Read all four meaning options.',
      'Tap the one that matches the word.',
      'Answer correctly to score; wrong answers end progress on that item.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'አራት አማራጮችን ያንብቡ።',
      'ትክክለኛውን ይምረጡ።',
    ],
  },
  'rhyme': {
    goalEn: 'Choose the word that rhymes with the prompt.',
    goalAm: 'ከተሰጠው ጋር የሚገጥመውን ቃል ይምረጡ።',
    stepsEn: [
      'Tap Play and read the rhyming prompt word.',
      'Compare the answer choices by sound.',
      'Tap the word that rhymes best.',
      'Correct picks add points through the set.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቃላትን በድምፅ ያወዳድሩ።',
      'የሚገጥመውን ይምረጡ።',
    ],
  },
  'target24': {
    goalEn: 'Use + − × ÷ on four numbers to make exactly 24.',
    goalAm: 'በ+ − × ÷ አራት ቁጥሮችን አጣምረው 24 ያድርጉ።',
    stepsEn: [
      'Tap Play — four numbers and operators appear.',
      'Tap numbers and operators in order to build an expression.',
      'Each number must be used exactly once.',
      'Hit 24 exactly to clear the puzzle and score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቁጥሮችን እና ኦፕሬተሮችን በቅደም ተከተል ይጫኑ።',
      'እያንዳንዱ ቁጥር አንድ ጊዜ ብቻ።',
      '24 ትክክለኛ ሲሆን ያሸንፋሉ።',
    ],
  },
  'crosssum': {
    goalEn: 'Fill the grid so rows and columns match their sums.',
    goalAm: 'ረድፎችና አምዶች ዒላማ ድምር እንዲያሳኩ ይሙሉ።',
    stepsEn: [
      'Tap Play to open the cross-sum board.',
      'Tap a cell, then pick a digit that fits the row and column clues.',
      'Use logic — no row or column may repeat illegally.',
      'Complete the grid to finish and earn points.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ሰሌድ ይምረጡ፣ ቁጥር ይጨምሩ።',
      'ረድፍና አምድ ግራሽ ይከተሉ።',
      'ሲሞላ ያጠናቅቁ።',
    ],
  },
  'logic': {
    goalEn: 'Deduce the correct layout from the clues.',
    goalAm: 'ከፍንጮች ትክክለኛውን ድርድር ያውጡ።',
    stepsEn: [
      'Tap Play and read all logic clues.',
      'Tap grid cells to cycle through valid symbols or states.',
      'Eliminate options that break a clue.',
      'Solve the full grid to complete the puzzle.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ፍንጮችን ያንብቡ።',
      'ሰሌዶችን ይቀይሩ።',
      'የሚጣሱ አማራጮችን ያስወግዱ።',
      'ሲፈቱ ያጠናቅቁ።',
    ],
  },
  'sequence': {
    goalEn: 'Find the pattern and pick the next item.',
    goalAm: 'ቅደም ተከተሉን አውቀው ቀጣዩን ይምረጡ።',
    stepsEn: [
      'Tap Play to see the sequence pattern.',
      'Study how shapes, numbers, or colors change.',
      'Tap the answer that continues the pattern.',
      'Correct streaks increase your score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቅደም ተከተሉን ይመልከቱ።',
      'ቀጣዩን ይምረጡ።',
    ],
  },
  'orbit-blast': {
    goalEn: 'Shoot orbiting targets and clear waves.',
    goalAm: 'የሚዞሩ ኢላማዎችን ይምቱ።',
    stepsEn: [
      'Tap Play — your shooter sits at the bottom.',
      'Tap or drag to aim at colored orbs on the track.',
      'Match shots to clear targets before they complete a lap.',
      'Survive waves and chain hits for a high score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ኢላማዎችን ለመምታት ይንኩ።',
      'ሞገዶችን ከመጨረሻቸው በፊት ያጽዱ።',
      'ተከታታይ መታዎች ነጥብ ይጨምራሉ።',
    ],
  },
  'candy-crunch': {
    goalEn: 'Match 3+ candies and beat level goals.',
    goalAm: '3+ ከረሜላዎችን ያዛምዱ።',
    stepsEn: [
      'Tap Play, then swap two adjacent candies.',
      'Create lines of 3 or more identical candies.',
      'Special combos clear larger areas for bonus points.',
      'Reach the level goal before moves run out.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ጎረቤት ከረሜላዎችን ይቀይሩ።',
      '3+ ተመሳሳይ ያስተካክሉ።',
      'ዒላማውን ከመጨረሻው በፊት ያሳልፉ።',
    ],
  },
  'brick-blitz': {
    goalEn: 'Break every brick without losing the ball.',
    goalAm: 'ኳሱ ሳይወድብ ሁሉንም ጡቦች ይስበሩ።',
    stepsEn: [
      'Tap Play — the ball launches toward the bricks.',
      'Drag or move the paddle to bounce the ball upward.',
      'Hit every brick to clear the stage.',
      'If the ball falls past the paddle, the run ends.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ፓዱን ያንቀሳቅሱ ኳሱን ይመልሱ።',
      'ሁሉንም ጡቦች ይስበሩ።',
      'ኳሱ ከፓዱ ሲወርድ ዙሩ ይቋርጣል።',
    ],
  },
  'fruit-slice': {
    goalEn: 'Slice fruit, avoid bombs, survive for weekly ETB ranks.',
    goalAm: 'ፍራፍሬ ይቁረጡ፣ ቦምብ ይዘውሩ፣ ለ ETB ይወዳደሩ።',
    stepsEn: [
      'Enter the weekly tournament, then tap Play.',
      'Swipe across fruit to slice it — +10 points each, combo bonus on streaks.',
      'Avoid bombs (−10 and combo reset).',
      'Miss 5 fruits and you are out; +2 points per second alive. Difficulty increases over time.',
    ],
    stepsAm: [
      'ሳምንታዊ ውድድር ይግቡ፣ Play ይንኩ።',
      'ፍራፍሬ ይቁረጡ +10 ነጥብ።',
      'ቦምብ አይቁረጡ (−10)።',
      '5 ፍራፍሬ ካመለጡ ይወጣሉ።',
    ],
  },
  'sky-hopper': {
    goalEn: 'Hop upward from platform to platform.',
    goalAm: 'ከመድረክ ወደ መድረክ ይዝለሉ።',
    stepsEn: [
      'Tap Play — your character auto-hops.',
      'Tap to jump higher or steer onto the next platform.',
      'Missing a platform ends the run.',
      'Climb as high as possible for the best score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ለመዝለል ይንኩ።',
      'መድረክ ካመለጡ ዙሩ ይቋርጣል።',
      'ከፍ ብለው ይውጡ።',
    ],
  },
  'bubble-pop': {
    goalEn: 'Pop bubbles by grouping 3+ of the same colour.',
    goalAm: '3+ ተመሳሳይ ቀለም አረፋዎችን ይፋኩ።',
    stepsEn: [
      'Tap Play, then aim with the shooter at the bottom.',
      'Tap to fire a bubble toward the cluster.',
      'When 3+ of the same colour connect, they pop and fall.',
      'Clear the ceiling bubbles before they reach the danger line.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'አረፋ ይተኩሱ።',
      '3+ ተመሳሳይ ሲገናኙ ይፈነዳሉ።',
      'ከአደጋ መስመር በፊት ሰሌዳውን ያጽዱ።',
    ],
  },
  'water-sort': {
    goalEn: 'Sort liquids so each tube holds one colour.',
    goalAm: 'እያንዳንዱ ቱብ አንድ ቀለም ብቻ እንዲኖረው ያድርጉ።',
    stepsEn: [
      'Tap Play — coloured layers fill several tubes.',
      'Tap a tube to select it, then tap another to pour the top layer.',
      'Only pour onto matching colour or into an empty tube.',
      'Sort every colour into its own tube to clear the level.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቱብ ይምረጡ፣ ወደ ሌላ ቱብ ይጫኑ።',
      'ተመሳሳይ ቀለም ወይም ባዶ ቱብ ብቻ።',
      'ሁሉንም ቀለሞች ያደርድሩ።',
    ],
  },
  'parking-jam': {
    goalEn: 'Slide cars to free the red car out the exit.',
    goalAm: 'ቀይ መኪኑ እንዲወጣ መኪኖችን ያንቀሳቅሱ።',
    stepsEn: [
      'Tap Play — cars block a parking lot grid.',
      'Tap a car, then tap an arrow to slide it along its lane.',
      'Cars only move forward/back in their direction.',
      'Clear a path so the red car reaches the exit gate.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'መኪን ይምረጡ፣ በመንገዱ ያንቀሳቅሱ።',
      'መኪኖች በአቅጣጫቸው ብቻ ይንቀሳቀሳሉ።',
      'ቀይ መኪኑ exit እንዲደርስ ያስተናግዱ።',
    ],
  },
  'laser-puzzle': {
    goalEn: 'Reflect the laser through every target.',
    goalAm: 'ሌዘሩን ወደ ሁሉም ኢላማዎች ያመሩ።',
    stepsEn: [
      'Tap Play — a laser fires from the red source.',
      'Tap mirror tiles to rotate them 90°.',
      'Bounce the beam off mirrors into all green targets.',
      'When every target lights up, the level is complete.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'መስታዎችን ለመሽከርከር ይጫኑ።',
      'ሌዘሩን ወደ ኢላማዎች ያመሩ።',
      'ሁሉም ኢላማዎች ሲበሩ ደረጃው ይጠናቀቃል።',
    ],
  },
  'piano-tiles': {
    goalEn: 'Tap black tiles only — avoid white tiles.',
    goalAm: 'ጥቁር ጡንጦችን ብቻ ይጫኑ።',
    stepsEn: [
      'Tap Play — four lanes scroll downward.',
      'Tap only the black tiles before they leave the screen.',
      'Hitting a white tile ends your run immediately.',
      'Survive 60 seconds as speed increases for max score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ጥቁር ጡንጦችን ብቻ ይጫኑ።',
      'ነጭ ጡንቻ ዙሩን ያበቃል።',
      '60 ሰከንድ ይቆዩ።',
    ],
  },
  'stack-tower': {
    goalEn: 'Stack blocks as high as you can.',
    goalAm: 'ብሎኮችን ከፍ ብለው ይዱ።',
    stepsEn: [
      'Tap Play — blocks slide across the top.',
      'Tap to drop the block onto the stack below.',
      'Misaligned drops trim the tower — perfect drops add bonus height.',
      'The tower falls if the block misses completely.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ብሎክ ለመጣል ይንኩ።',
      'ትክክለኛ ጣት ተጨማሪ ነጥብ ይሰጣል።',
      'ብሎክ ሙሉ በሙሉ ካልገባ ግንቡ ይወድቃል።',
    ],
  },
  'crossy-road': {
    goalEn: 'Cross roads and rivers without getting hit.',
    goalAm: 'መንገዶችን እና ወንዞችን ያልፉ።',
    stepsEn: [
      'Tap Play — your character waits at the start.',
      'Tap or swipe to hop forward, left, or right.',
      'Cross traffic and logs before the idle timer runs out.',
      'Getting hit ends the run — go farther for a higher score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ወደፊት፣ ግራ ወይም ቀኝ ይዝለሉ።',
      'ትራፊክን እና ወንዞችን ያልፉ።',
      'ከመቆየት በፊት ይንቀሳቀሱ።',
    ],
  },
  'block-blast': {
    goalEn: 'Place all three pieces and clear full lines.',
    goalAm: 'ሦስቱን ቁራዎች ይቀምጡ መስመሮችን ያጽዱ።',
    stepsEn: [
      'Tap Play — an 8×8 board and three pieces appear.',
      'Drag each piece onto empty cells (all three must fit).',
      'Filled rows or columns clear and score points.',
      'If no piece fits, the round ends — plan ahead.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቁራዎችን በሰሌዳ ላይ ይጎትቱ።',
      'ሙሉ መስመሮች ይጠፋሉ።',
      'ቦታ ካልተገኘ ዙሩ ይቋርጣል።',
    ],
  },
  'tile-connect': {
    goalEn: 'Connect matching pairs with at most two turns.',
    goalAm: 'ጥንዶችን በሁለት ጥረጥረጥ ብቻ ያገናኙ።',
    stepsEn: [
      'Tap Play — identical tiles appear on the board.',
      'Tap two matching tiles.',
      'A valid path may go straight and bend at most twice — no blocking tiles.',
      'Clear all pairs across 5 boards to win.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ተመሳሳይ ሰሌዶችን ይጫኑ።',
      'መንገዱ ሁለት ጊዜ ብቻ ይጠጋል።',
      '5 ሰሌዶችን ያጠናቅቁ።',
    ],
  },
  'hexa-block': {
    goalEn: 'Fill honeycomb rows with hex pieces.',
    goalAm: 'ሀክስ ቁራዎችን በ honeycomb ይቀምጡ።',
    stepsEn: [
      'Tap Play — hex clusters wait in the tray.',
      'Tap a cluster, then tap the honeycomb grid to place it.',
      'Full horizontal rows clear for bonus points.',
      'Game ends when no cluster fits anywhere.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቁራ ይምረጡ፣ በ grid ላይ ይቀምጡ።',
      'ሙሉ መስመሮች ይጠፋሉ።',
      'ቦታ ካልተገኘ ዙሩ ይቋርጣል።',
    ],
  },
  'knife-hit': {
    goalEn: 'Stick knives into the log without hitting blades.',
    goalAm: 'ቢላዎችን ሳይገናኙ በ trunk ላይ ይትከሉ።',
    stepsEn: [
      'Tap Play — a log spins at the center.',
      'Tap to throw a knife into the wood.',
      'Knives must land in gaps — hitting another blade ends the run.',
      'Stick enough knives to complete the level.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቢላ ለመጣል ይንኩ።',
      'ቢላ ላይ ቢላ ከገናኘ ዙሩ ይቋርጣል።',
      'በቂ ቢላዎችን ለመትከል ይቀጥሉ።',
    ],
  },
  'helix-jump': {
    goalEn: 'Drop the ball through matching colour gaps.',
    goalAm: 'ኳሱን ተመሳሳይ ቀለም ክፍተቶችን ያעבירו።',
    stepsEn: [
      'Tap Play — a ball sits on a spinning helix tower.',
      'Swipe or tap to rotate the tower.',
      'Pass through segments that match the ball colour.',
      'Hit the wrong colour and the run ends.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ማዕዘኑን ያሽከርክሩ።',
      'ተመሳሳይ ቀለም ይለፉ።',
      'ልክ ያልሆነ ቀለም ዙሩን ያበቃል።',
    ],
  },
  'hill-climb': {
    goalEn: 'Drive as far as you can without flipping or running out of fuel.',
    goalAm: 'ነዳጅ ሳይጠፋ እና ሳይገለብት ርቀት ይሂዱ።',
    stepsEn: [
      'Tap Play — hold gas to accelerate uphill.',
      'Tap brake on steep descents to avoid flipping.',
      'Collect fuel cans along the track.',
      'Crash, flip, or empty fuel ends the run.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ጋዝ ይጫኑ፣ በ downhill brake ይጫኑ።',
      'ነዳጅ ይሰብስቡ።',
      'መገለብት ወይም መጨረስ ዙሩን ያበቃል።',
    ],
  },
  'tower-defense': {
    goalEn: 'Stop 15 enemy waves with placed towers.',
    goalAm: '15 ጥላቅ መከላከያ ታወሮችን በመጠቀም ያስቆሙ።',
    stepsEn: [
      'Tap Play, then tap empty slots to place towers.',
      'Tap placed towers to upgrade range or damage.',
      'Tap Start Wave when ready — enemies follow the path.',
      'Survive all 15 waves without letting too many through.',
    ],
    stepsAm: [
      'Play ይንኩ፣ ታወር ይቀምጡ።',
      'ያሳድጉ።',
      'Start Wave ይንኩ።',
      '15 ጥላቅ ያሳልፉ።',
    ],
  },
  'draw-bridge': {
    goalEn: 'Draw a bridge and drive the car across.',
    goalAm: 'ድልድይ ይሳሉ መኪኑ እንዲያልፍ ያድርጉ።',
    stepsEn: [
      'Tap Play — a gap separates the car from the goal.',
      'Draw a line bridge between the platforms.',
      'Tap DRIVE to send the car across your bridge.',
      'Too steep or short bridges collapse — adjust and retry.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ድልድይ ይሳሉ።',
      'DRIVE ይንኩ።',
      'ድልድይ ከ collapsed ከዚያ ይሞክሩ።',
    ],
  },
  'ball-sort': {
    goalEn: 'Sort balls so each tube is one colour.',
    goalAm: 'እያንዳንዱ ቱብ አንድ ቀለም ብቻ።',
    stepsEn: [
      'Tap Play — mixed colour balls fill tubes.',
      'Tap source tube, then destination to move the top ball.',
      'Move only onto matching colour or empty tubes.',
      'Sort all colours to finish the puzzle.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቱብ ይምረጡ፣ ወደ ሌላ ቱብ ይጫኑ።',
      'ተመሳሳይ ወይም ባዶ ቱብ ብቻ።',
      'ሁሉንም ያደርድሩ።',
    ],
  },
  'jewel-match': {
    goalEn: 'Match jewels and beat three score targets.',
    goalAm: '3+ ውድሮችን ያዛምዱ ዒላማዎችን ያሳልፉ።',
    stepsEn: [
      'Tap Play — an 8×8 jewel board appears.',
      'Tap two adjacent jewels to swap them.',
      'Match 3+ in a row for points and cascades.',
      'Hit each level target before moves run out.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ጎረቤት ውድሮችን ይቀይሩ።',
      '3+ በረድፍ ያዛምዱ።',
      'ዒላማውን ከመጨረሻው በፊት ያሳልፉ።',
    ],
  },
  'reflex-tap': {
    goalEn: 'Tap targets fast for 60 seconds.',
    goalAm: '60 ሰከንድ ውስጥ በፍጥነት ይጫኑ።',
    stepsEn: [
      'Tap Play — targets appear in random spots.',
      'Tap each glowing circle before it fades.',
      'Three waves get faster — misses cost points.',
      'Maximize hits before the timer ends.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ኢላማዎችን በፍጥነት ይጫኑ።',
      '3 ጥላቅ ፍጥነት ይጨምራል።',
      'ጊዜ ከመጨረሱ በፊት ብዙ ይጫኑ።',
    ],
  },
  'doodle-jump': {
    goalEn: 'Bounce upward on platforms.',
    goalAm: 'በመድረኮች ላይ ከፍ ብለው ይዝለሉ።',
    stepsEn: [
      'Tap Play — your character auto-bounces.',
      'Tilt or tap left/right to steer onto platforms.',
      'Missing a platform ends the run.',
      'Climb higher for a better height score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ግራ/ቀኝ ይ steer ያድርጉ።',
      'መድረክ ካመለጡ ይቋርጡ።',
      'ከፍ ብለው ይውጡ።',
    ],
  },
  'zigzag': {
    goalEn: 'Stay on the path as the ball auto-runs.',
    goalAm: 'ኳሱ ሲሮጥ በመንገዱ ላይ ይቆዩ።',
    stepsEn: [
      'Tap Play — the ball moves forward automatically.',
      'Tap at corners to turn left or right.',
      'Fall off the edge and the run ends.',
      'Longer distance means a higher score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'በማዕዘኖች ላይ ይንኩ።',
      'ከመንገዱ ከወደቁ ዙሩ ይቋርጣል።',
      'ርቀት ነጥብ ይጨምራል።',
    ],
  },
  'color-switch': {
    goalEn: 'Match your ball colour to pass gates.',
    goalAm: 'ቀለምዎን ከበሮች ጋር ያዛምዱ።',
    stepsEn: [
      'Tap Play — your ball falls through a spinning gate.',
      'Tap to cycle the ball colour.',
      'Pass only through segments matching your colour.',
      'Wrong colour contact ends the run.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቀለም ለመቀየር ይንኩ።',
      'ተመሳሳይ ክፍል ብቻ ይለፉ።',
      'ልክ ያልሆነ ቀለም ዙሩን ያበቃል።',
    ],
  },
  'rope-rescue': {
    goalEn: 'Swing to the safe zone.',
    goalAm: 'ወደ SAFE zone በ swing ይድረሱ።',
    stepsEn: [
      'Tap Play — draw a rope line from anchor to anchor.',
      'Tap SWING to launch the character along the rope.',
      'Avoid spikes and gaps.',
      'Reach the green SAFE area to score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ገመድ ይሳሉ።',
      'SWING ይንኩ።',
      'SAFE zone ይድረሱ።',
    ],
  },
  'pipe-connect': {
    goalEn: 'Link the water source to the drain.',
    goalAm: 'ውሃን ከምንጭ ወደ drain ያገናኙ።',
    stepsEn: [
      'Tap Play — pipe tiles sit on the grid.',
      'Tap a tile to rotate it 90°.',
      'Connect open ends from source to drain.',
      'Complete 5 levels to finish the set.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ቧንቧ ይሽከርከሩ።',
      'ምንጭ ወደ drain ያገናኙ።',
      '5 ደረጃዎችን ያጠናቅቁ።',
    ],
  },
  'ball-maze': {
    goalEn: 'Guide the ball through five mazes.',
    goalAm: 'ኳሱን በ 5 maze ውስጥ ያስመርጡ።',
    stepsEn: [
      'Tap Play — tilt or steer the ball.',
      'Navigate walls to reach the goal hole.',
      'Finish each maze to unlock the next.',
      'Fewer mistakes and faster times score higher.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ኳሱን ያ steer ያድርጉ።',
      'ዒላማውን ይድረሱ።',
      '5 maze ያጠናቅቁ።',
    ],
  },
  'arrow-shot': {
    goalEn: 'Hit moving targets despite wind.',
    goalAm: 'ነፋስ ቢኖርም ኢላማዎችን ይምቱ።',
    stepsEn: [
      'Tap Play — drag or tap to aim the bow.',
      'Watch the wind indicator and adjust angle.',
      'Release to shoot — accuracy streaks multiply score.',
      'Missing too many targets ends the round.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ለመድረስ ይጎትቱ።',
      'ነፋስን ያስተውሉ።',
      'ትክክለኛ መታዎች ነጥብ ይጨምራሉ።',
    ],
  },
  'slide-puzzle': {
    goalEn: 'Order tiles 1–15 with one empty space.',
    goalAm: '1–15 በቅደም ተከተል ያስተካክሉ።',
    stepsEn: [
      'Tap Play — numbered tiles and one blank cell.',
      'Tap a tile next to the blank to slide it into the empty space.',
      'Keep sliding until rows read 1–15 left to right, top to bottom.',
      'Fewer moves earn a better score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'ባዶውን ቦታ ጎረቤት ሰሌድ ይጫኑ።',
      '1–15 እስኪሆን ይንቀሳቀሱ።',
      'ትንሽ እንቅስቃሴ ጥሩ ነጥብ ይሰጣል።',
    ],
  },
  'race-car': {
    goalEn: 'Dodge traffic and drive as far as you can.',
    goalAm: 'ትራፊክን ይ dodge ያሽከረክሩ።',
    stepsEn: [
      'Tap Play — your car auto-accelerates.',
      'Swipe or tap left/right to change lanes.',
      'Avoid other cars; collect coins and shields.',
      'Crash ends the run — distance is your score.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'መንገድ ይቀይሩ።',
      'ሳንቲም እና shield ይሰብስቡ።',
      'ግድግዳ ከጋጨት ዙሩ ይቋርጣል።',
    ],
  },
};

export function getHowToGuide(gameId: string, nameEn: string, nameAm: string): HowToGuide {
  const g = HOWTO_GUIDES[gameId];
  if (g) return g;
  return {
    goalEn: `Score as high as you can in ${nameEn}.`,
    goalAm: `በ${nameAm} ከፍተኛ ነጥብ ያስመዝግቡ።`,
    stepsEn: [
      'Tap Play on the game card to open the menu.',
      'Read the on-screen hints, then start your round.',
      'Your score is saved when the round ends.',
    ],
    stepsAm: [
      'Play ይንኩ።',
      'መመሪያዎችን ያንብቡ፣ ዙር ይጀምሩ።',
      'ዙሩ ሲያልቅ ነጥብዎ ይቀመጣል።',
    ],
  };
}
