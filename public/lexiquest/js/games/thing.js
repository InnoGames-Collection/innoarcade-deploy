/* Name That Picture — identify the object with the precise word. */
(function () {
  "use strict";
  const { el, shuffled } = LQ;

  LQ.register({
    id: "thing",
    title: "Name That Picture",
    icon: "🏺",
    tagline: "Can you put the right word to the picture? Choose wisely.",
    render: LQ.mcqQuiz({
      gameId: "thing",
      rounds: 10,
      choiceCols: 2,
      help: `<b>Goal:</b> match each picture to its <b>precise</b> name.<br><br>
        <b>How to play:</b><br>
        1. Look at the picture.<br>
        2. Pick the exact word for it — beware: the wrong answers are real words
        for <i>similar</i> things (a sextant is not a compass!).<br>
        3. Miss one and the right word is shown — that's how vocabulary grows.<br><br>
        10 pictures per round; 7+ correct wins.`,
      bank() { return shuffled(LQ_DATA.THING); },
      renderPrompt(item) {
        return el("div", null,
          el("div", { class: "emoji", text: item.emoji }),
          el("p", { class: "prompt", text: "What is this called?" })
        );
      },
      choicesFor(item) {
        return [{ label: item.a, correct: true }]
          .concat(item.wrong.map((w) => ({ label: w, correct: false })));
      },
      feedback(item, ok) {
        return ok ? "Correct!" : `That is a ${item.a}.`;
      },
      resultTitle(score, total) {
        if (score === total) return "🏆 Perfect eye!";
        if (score >= total * 0.7) return "🔍 Sharp-eyed!";
        return "🏺 Keep looking!";
      },
    }),
  });
})();
