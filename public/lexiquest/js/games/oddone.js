/* Odd One Out — which of the four doesn't belong? */
(function () {
  "use strict";
  const { el, shuffled } = LQ;

  LQ.register({
    id: "oddone",
    category: "analytical",
    title: "Odd One Out",
    icon: "🦄",
    tagline: "Three belong together. One is an impostor. Spot it.",
    render: LQ.mcqQuiz({
      gameId: "oddone",
      rounds: 10,
      choiceCols: 2,
      help: `<b>Goal:</b> find the impostor in each group of four.<br><br>
        <b>How to play:</b><br>
        1. Three of the four share something — a category, a property, a habitat.<br>
        2. Tap the one that doesn't belong.<br>
        3. Every answer explains the hidden connection.<br><br>
        <b>Tip:</b> the link is rarely about spelling or length — think about what
        the things <i>are</i> (fish vs. mammal, metal vs. tree, still vs. flowing).
        7+ of 10 wins.`,
      bank() { return shuffled(LQ_DATA.ODDONE); },
      renderPrompt() {
        return el("p", { class: "prompt", text: "Which one doesn't belong?" });
      },
      choicesFor(item) {
        return [{ label: item.odd, correct: true }]
          .concat(item.rest.map((w) => ({ label: w, correct: false })));
      },
      feedback(item, ok) {
        return (ok ? "Correct! " : "") + item.why;
      },
      resultTitle(score, total) {
        if (score === total) return "🦄 Impostor radar: flawless!";
        if (score >= total * 0.7) return "🔎 Sharp categorizer!";
        return "🤷 The impostors fooled you!";
      },
    }),
  });
})();
