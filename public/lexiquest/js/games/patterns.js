/* Pattern Next — what comes next in the symbol sequence? */
(function () {
  "use strict";
  const { el, shuffled, randInt } = LQ;

  const SYMBOL_SETS = [
    ["🔴", "🔵", "🟡", "🟢", "🟣"],
    ["▲", "■", "●", "◆", "★"],
    ["🌑", "🌓", "🌕", "🌗", "⭐"],
    ["🐝", "🦋", "🐞", "🐜", "🕷️"],
  ];

  // generators return { seq: shown symbols, next, rule }
  function genPeriodic() {
    const set = SYMBOL_SETS[randInt(0, SYMBOL_SETS.length - 1)];
    const period = randInt(2, 3);
    const motif = shuffled(set).slice(0, period);
    const len = period * 2 + randInt(1, period);
    const seq = Array.from({ length: len }, (_, i) => motif[i % period]);
    return { seq, next: motif[len % period], rule: `repeats every ${period}`, pool: set };
  }

  function genDoubling() {
    // A B B A B B / A AB ABB style: k copies growing
    const set = SYMBOL_SETS[randInt(0, SYMBOL_SETS.length - 1)];
    const [a, b] = shuffled(set);
    // pattern: a, b, a, b, b, a, b, b, b... (b-count grows after each a)
    const seq = [];
    let count = 1;
    while (seq.length < 7) {
      seq.push(a);
      for (let i = 0; i < count && seq.length < 8; i++) seq.push(b);
      count++;
    }
    const next = (() => {
      // simulate one more step
      const full = [];
      let k = 1;
      while (full.length <= seq.length) {
        full.push(a);
        for (let i = 0; i < k; i++) full.push(b);
        k++;
      }
      return full[seq.length];
    })();
    return { seq, next, rule: `one more ${b} after every ${a}`, pool: set };
  }

  function genMirror() {
    const set = SYMBOL_SETS[randInt(0, SYMBOL_SETS.length - 1)];
    const motif = shuffled(set).slice(0, 3);
    const palindrome = motif.concat(motif.slice(0, -1).reverse()); // abcba
    const seq = palindrome.concat(palindrome).slice(0, 7);
    return { seq, next: palindrome[7 % palindrome.length], rule: "a mirrored motif repeats", pool: set };
  }

  function makeItem() {
    const gen = [genPeriodic, genPeriodic, genDoubling, genMirror][randInt(0, 3)];
    const { seq, next, rule, pool } = gen();
    const wrongs = shuffled(pool.filter((s) => s !== next)).slice(0, 3);
    return { seq, next, rule, wrongs };
  }

  LQ.register({
    id: "patterns",
    category: "analytical",
    title: "Pattern Next",
    icon: "🔮",
    tagline: "Read the symbol sequence, predict what comes next.",
    render: LQ.mcqQuiz({
      gameId: "patterns",
      rounds: 10,
      choiceCols: 2,
      help: `<b>Goal:</b> predict the next symbol in the sequence.<br><br>
        <b>How to play:</b><br>
        1. Read the symbols left to right and find the rule.<br>
        2. Tap the symbol that comes next where the <b>?</b> is.<br><br>
        <b>The rules you'll meet:</b><br>
        • <b>Repeats</b> — a short motif loops (🔴🔵🔴🔵…).<br>
        • <b>Growing runs</b> — one symbol appears one more time after each round.<br>
        • <b>Mirrors</b> — a motif plays forward, then backward.<br><br>
        7+ of 10 wins.`,
      bank() { return Array.from({ length: 10 }, makeItem); },
      renderPrompt(item) {
        return el("div", null,
          el("div", { class: "emoji", style: "font-size: clamp(28px, 8vw, 40px); letter-spacing: 4px;", text: item.seq.join(" ") + "  ?" }),
          el("p", { class: "prompt", text: "What comes next?" })
        );
      },
      choicesFor(item) {
        return [{ label: item.next, correct: true }]
          .concat(item.wrongs.map((w) => ({ label: w, correct: false })));
      },
      feedback(item, ok) {
        return (ok ? "Correct — " : "It was " + item.next + " — ") + "the pattern " + item.rule + ".";
      },
      resultTitle(score, total) {
        if (score === total) return "🔮 Pattern prophet!";
        if (score >= total * 0.7) return "✨ Keen eye!";
        return "🌀 The patterns spun you around!";
      },
    }),
  });
})();
