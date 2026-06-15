/* Fact or Fib — true/false statements about word meanings. */
(function () {
  "use strict";
  const { el, shuffled } = LQ;

  LQ.register({
    id: "tf",
    title: "Fact or Fib",
    icon: "⚖️",
    tagline: "True or false? Trust your inner lexicographer.",
    render: LQ.mcqQuiz({
      gameId: "tf",
      rounds: 12,
      choiceCols: 2,
      help: `<b>Goal:</b> judge 12 statements about what words really mean.<br><br>
        <b>How to play:</b><br>
        1. Read the statement, e.g. <i>“Nocturnal describes animals active during the day.”</i><br>
        2. Tap <b>True</b> or <b>False</b>.<br>
        3. Every answer comes with a short explanation — the why is the fun part.<br><br>
        <b>Tip:</b> word roots help (noct- = night, biblio- = book). 9+ of 12 wins.`,
      bank() { return shuffled(LQ_DATA.TF); },
      renderPrompt(item) {
        return el("p", { class: "prompt", text: item.s });
      },
      choicesFor(item) {
        return [
          { label: "True", correct: item.t },
          { label: "False", correct: !item.t },
        ];
      },
      feedback(item, ok) {
        return (ok ? "Correct! " : "Not quite. ") + item.why;
      },
      resultTitle(score, total) {
        if (score === total) return "⚖️ Flawless judgment!";
        if (score >= total * 0.7) return "✅ Strong instincts!";
        return "🤔 The dictionary awaits!";
      },
    }),
  });
})();
