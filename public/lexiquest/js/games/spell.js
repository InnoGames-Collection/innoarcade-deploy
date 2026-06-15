/* Spell Check — pick the correct spelling of commonly misspelled words. */
(function () {
  "use strict";
  const { el, shuffled } = LQ;

  LQ.register({
    id: "spell",
    title: "Spell Check",
    icon: "🐝",
    tagline: "One of these spellings is right. The rest are traps.",
    render: LQ.mcqQuiz({
      gameId: "spell",
      rounds: 10,
      choiceCols: 2,
      help: `<b>Goal:</b> spot the one correct spelling among convincing fakes.<br><br>
        <b>How to play:</b><br>
        1. Read the definition in quotes.<br>
        2. Exactly <b>one</b> of the four spellings is right — tap it.<br><br>
        <b>Tips:</b> watch for doubled letters (a<u>cc</u>o<u>mm</u>odate),
        sneaky vowel swaps (sep<u>a</u>rate, not “seperate”), and silent letters.
        Say the word slowly in your head before choosing. 7+ of 10 wins.`,
      bank() { return shuffled(LQ_DATA.SPELL); },
      renderPrompt(item) {
        return el("div", null,
          el("p", { class: "prompt", text: "Which spelling is correct?" }),
          el("p", { class: "sub", text: "“" + item.def + "”" })
        );
      },
      choicesFor(item) {
        return [{ label: item.a, correct: true }]
          .concat(item.wrong.map((w) => ({ label: w.trim(), correct: false })));
      },
      feedback(item, ok) {
        return ok ? "Correct!" : `The correct spelling is “${item.a}”.`;
      },
      resultTitle(score, total) {
        if (score === total) return "🐝 Spelling Bee Champion!";
        if (score >= total * 0.7) return "📝 Solid speller!";
        return "📖 Time to hit the dictionary!";
      },
    }),
  });
})();
