/* Shared multiple-choice quiz runner used by several LexiQuest games. */
(function () {
  "use strict";
  const { el, modal, recordResult, shuffled } = LQ;

  /**
   * opts: {
   *   gameId, rounds,                 — number of questions per run
   *   bank()        -> array of items (fresh copy each run)
   *   renderPrompt(item) -> Node      — question area content
   *   choicesFor(item) -> [{label, correct}]
   *   feedback(item, wasCorrect) -> string
   *   resultTitle(score, total) -> string
   *   resultBody(score, total) -> string (optional)
   *   choiceCols (optional: 2 for two-column layout)
   * }
   */
  LQ.mcqQuiz = function (opts) {
    return function render(mount) {
      function newRun() {
        mount.innerHTML = "";
        startRun();
      }

      function startRun() {
        const items = opts.bank().slice(0, opts.rounds);
        let idx = 0;
        let score = 0;
        let streak = 0;

        const progress = el("div", { class: "quiz-progress" }, el("div", { class: "fill" }));
        const qCard = el("div", { class: "quiz-q" });
        const scoreline = el("div", { class: "scoreline" });
        const wrap = el("div", { class: "quiz-wrap" }, progress, qCard, scoreline);
        mount.appendChild(el("div", { class: "game-toolbar" },
          opts.help
            ? el("button", {
                class: "btn", text: "How to play",
                onclick: () => modal({ title: "How to play", body: opts.help }),
              })
            : null,
          el("button", { class: "btn", text: "Restart", onclick: newRun })
        ));
        mount.appendChild(wrap);

        function paintScore() {
          scoreline.textContent = `Score ${score}/${idx} · Streak ${streak}`;
          progress.firstChild.style.width = (idx / items.length) * 100 + "%";
        }

        function nextQuestion() {
          if (idx >= items.length) return finish();
          const item = items[idx];
          qCard.innerHTML = "";
          qCard.appendChild(el("div", { class: "sub", text: `Question ${idx + 1} of ${items.length}` }));
          qCard.appendChild(opts.renderPrompt(item));
          const fb = el("div", { class: "quiz-feedback" });
          const choices = shuffled(opts.choicesFor(item));
          const grid = el("div", { class: "choices" + (opts.choiceCols === 2 ? " two-col" : "") });
          const btns = choices.map((c) => {
            const b = el("button", { class: "choice", text: c.label, onclick: () => answer(c, b) });
            grid.appendChild(b);
            return b;
          });
          qCard.appendChild(grid);
          qCard.appendChild(fb);
          paintScore();

          function answer(c, btn) {
            btns.forEach((b) => { b.disabled = true; });
            LQ.sound(c.correct ? "good" : "bad");
            if (c.correct) {
              btn.classList.add("correct");
              score++; streak++;
              fb.className = "quiz-feedback good";
            } else {
              btn.classList.add("wrong");
              const right = btns[choices.findIndex((x) => x.correct)];
              if (right) right.classList.add("correct");
              streak = 0;
              fb.className = "quiz-feedback bad";
            }
            fb.textContent = opts.feedback(item, c.correct);
            idx++;
            paintScore();
            setTimeout(nextQuestion, c.correct ? 950 : 2100);
          }
        }

        function finish() {
          const won = score >= Math.ceil(items.length * 0.7);
          LQ.sound(won ? "win" : "bad");
          recordResult(opts.gameId, { won, score });
          const body = (opts.resultBody && opts.resultBody(score, items.length)) ||
            `You got <b>${score} of ${items.length}</b> correct.`;
          qCard.innerHTML = "";
          qCard.appendChild(el("div", { class: "prompt", text: opts.resultTitle(score, items.length) }));
          const div = el("div");
          div.innerHTML = body;
          qCard.appendChild(div);
          qCard.appendChild(el("div", { class: "mt" },
            el("button", { class: "btn primary", text: "Play again", onclick: newRun })
          ));
          progress.firstChild.style.width = "100%";
        }

        nextQuestion();
      }

      newRun();
    };
  };
})();
