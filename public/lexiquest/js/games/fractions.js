/* Fraction Duel — fractions, percentages, and proportions under pressure. */
(function () {
  "use strict";
  const { el, randInt, shuffled } = LQ;

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function frac(n, d) { const g = gcd(n, d); return `${n / g}/${d / g}`; }

  function genCompare() {
    // four distinct-value fractions; pick the largest
    const fracs = [];
    const seen = new Set();
    while (fracs.length < 4) {
      const d = randInt(2, 12), n = randInt(1, d - 1);
      const v = n / d;
      const key = v.toFixed(4);
      if (seen.has(key)) continue;
      seen.add(key);
      fracs.push({ n, d, v });
    }
    const max = fracs.reduce((a, b) => (b.v > a.v ? b : a));
    return {
      prompt: "Which fraction is the largest?",
      sub: "Compare their true values.",
      choices: fracs.map((f) => ({ label: frac(f.n, f.d), correct: f === max })),
      explain: `${frac(max.n, max.d)} ≈ ${(max.v * 100).toFixed(0)}% — the biggest slice.`,
    };
  }

  function genPercent() {
    const p = [10, 20, 25, 50, 75][randInt(0, 4)];
    const base = randInt(2, 20) * 20;
    const ans = (p / 100) * base;
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const w = ans + [-20, -10, -5, 5, 10, 20, ans / 2, ans][randInt(0, 7)] * (randInt(0, 1) ? 1 : -1);
      if (w !== ans && w > 0 && Number.isInteger(w)) wrongs.add(w);
    }
    return {
      prompt: `What is ${p}% of ${base}?`,
      sub: "No calculator needed — find the shortcut.",
      choices: [{ label: String(ans), correct: true }]
        .concat([...wrongs].map((w) => ({ label: String(w), correct: false }))),
      explain: `${p}% of ${base} = ${ans}.`,
    };
  }

  function genEquivalent() {
    const d = randInt(2, 9), n = randInt(1, d - 1);
    const k = randInt(2, 6);
    const correct = `${n * k}/${d * k}`;
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const dn = n * k + randInt(-2, 2), dd = d * k + randInt(-2, 2);
      const w = `${dn}/${dd}`;
      if (dn > 0 && dd > 1 && dn !== dd && Math.abs(dn / dd - n / d) > 1e-9) wrongs.add(w);
    }
    return {
      prompt: `Which equals ${n}/${d}?`,
      sub: "Find the equivalent fraction.",
      choices: [{ label: correct, correct: true }]
        .concat([...wrongs].map((w) => ({ label: w, correct: false }))),
      explain: `${n}/${d} × ${k}/${k} = ${correct}.`,
    };
  }

  function bank() {
    const gens = [genCompare, genPercent, genEquivalent];
    return Array.from({ length: 10 }, (_, i) => gens[i % 3]()).sort(() => 0.5).map((x) => x);
  }

  LQ.register({
    id: "fractions",
    category: "math",
    title: "Fraction Duel",
    icon: "🍕",
    tagline: "Fractions, percentages, and equivalents — pick the right slice.",
    render: LQ.mcqQuiz({
      gameId: "fractions",
      rounds: 10,
      choiceCols: 2,
      help: `<b>Goal:</b> survive 10 quick fraction and percentage questions.<br><br>
        <b>You'll see three kinds:</b><br>
        • <b>Largest fraction</b> — compare values, not digits (7/12 beats 1/2).<br>
        • <b>Percent of a number</b> — use shortcuts: 10% = ÷10, 25% = ÷4, 75% = ¾.<br>
        • <b>Equivalent fractions</b> — same value, scaled up (2/3 = 8/12).<br><br>
        <b>Tip:</b> when comparing, turn fractions into rough decimals in your head.
        7+ of 10 wins.`,
      bank() { return shuffled(bank()); },
      renderPrompt(item) {
        return el("div", null,
          el("p", { class: "prompt", text: item.prompt }),
          el("p", { class: "sub", text: item.sub })
        );
      },
      choicesFor(item) { return item.choices; },
      feedback(item, ok) { return ok ? "Correct!" : item.explain; },
      resultTitle(score, total) {
        if (score === total) return "🍕 Fraction champion!";
        if (score >= total * 0.7) return "➗ Sharp slicing!";
        return "🔪 Keep practicing those slices!";
      },
    }),
  });
})();
