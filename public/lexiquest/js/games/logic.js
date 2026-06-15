/* Logic Riddles — short deduction puzzles. Read carefully. */
(function () {
  "use strict";
  const { el, shuffled } = LQ;

  LQ.register({
    id: "logic",
    category: "analytical",
    title: "Logic Riddles",
    icon: "🕵️",
    tagline: "Ten short deduction puzzles. The obvious answer is usually the trap.",
    render: LQ.mcqQuiz({
      gameId: "logic",
      rounds: 10,
      help: `<b>Goal:</b> solve 10 short deduction puzzles.<br><br>
        <b>How to play:</b><br>
        1. Read the riddle <b>twice</b> — every word matters (“all but 9” ≠ “9 ran away”).<br>
        2. Eliminate answers that contradict the clues.<br>
        3. Tap your answer; each one comes with the reasoning explained.<br><br>
        <b>Tip:</b> the answer that jumps out first is often the trap. Sketching the
        order (Ana &gt; Ben &gt; Carl) in your head beats guessing. 7+ of 10 wins.`,
      bank() { return shuffled(LQ_DATA.LOGIC); },
      renderPrompt(item) {
        return el("p", { class: "prompt", text: item.q });
      },
      choicesFor(item) {
        return [{ label: item.a, correct: true }]
          .concat(item.wrong.map((w) => ({ label: w, correct: false })));
      },
      feedback(item, ok) {
        return (ok ? "Correct! " : "") + item.why;
      },
      resultTitle(score, total) {
        if (score === total) return "🕵️ Master detective!";
        if (score >= total * 0.7) return "🧩 Solid deduction!";
        return "🪤 The traps got you!";
      },
    }),
  });
})();
