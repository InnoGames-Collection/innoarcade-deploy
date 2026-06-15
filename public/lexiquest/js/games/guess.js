/* Quad Grid & Octo Grid — solve N five-letter words at once (Quordle/Octordle-style). */
(function () {
  "use strict";
  const { el, toast, modal, keyboard, typeCatcher, recordResult, mulberry32, dayNumber, shuffled } = LQ;

  const WORD_LEN = 5;
  const VALID = new Set(LQ_DATA.DICT5);
  const ANSWERS = LQ_DATA.ANSWERS5;

  function scoreGuess(guess, answer) {
    // returns array of 'good' | 'near' | 'bad'
    const res = new Array(WORD_LEN).fill("bad");
    const remaining = {};
    for (let i = 0; i < WORD_LEN; i++) {
      if (guess[i] === answer[i]) res[i] = "good";
      else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < WORD_LEN; i++) {
      if (res[i] === "good") continue;
      if (remaining[guess[i]] > 0) { res[i] = "near"; remaining[guess[i]]--; }
    }
    return res;
  }

  function makeGame(boardCount, maxGuesses) {
    return function render(mount) {
      let cleanup = null;

      function newRound(seedOffset) {
        if (cleanup) cleanup();
        mount.innerHTML = "";
        cleanup = startRound(seedOffset);
      }

      function startRound(seedOffset) {
        const rnd = mulberry32(dayNumber() * 7919 + boardCount * 131 + (seedOffset || 0));
        const answers = shuffled(ANSWERS, rnd).slice(0, boardCount);
        const guesses = [];           // accepted guesses (strings)
        const solvedAt = new Array(boardCount).fill(-1);
        let current = "";
        let over = false;

        // --- build DOM ---
        const boardEls = [];
        const boardsWrap = el("div", {
          class: "boards " + (boardCount > 4 ? "cols-4" : "cols-2"),
        });
        const tileClass = boardCount > 4 ? "tile small" : "tile small";
        for (let b = 0; b < boardCount; b++) {
          const board = el("div", { class: "board" });
          for (let r = 0; r < maxGuesses; r++) {
            const row = el("div", { class: "tile-row" });
            for (let c = 0; c < WORD_LEN; c++) row.appendChild(el("div", { class: tileClass }));
            board.appendChild(row);
          }
          boardEls.push(board);
          boardsWrap.appendChild(board);
        }

        const status = el("p", { class: "center dim", text: `Guess ${guesses.length + 1} of ${maxGuesses}` });
        const kbd = keyboard(onKey);

        const toolbar = el("div", { class: "game-toolbar" },
          el("button", { class: "btn", text: "How to play", onclick: showHelp }),
          el("button", { class: "btn", text: "New game", onclick: () => newRound(Math.floor(Math.random() * 1e6) + 1) }),
          el("button", { class: "btn danger", text: "Give up", onclick: giveUp })
        );

        mount.appendChild(toolbar);
        mount.appendChild(status);
        mount.appendChild(boardsWrap);
        mount.appendChild(kbd.element);
        typeCatcher(onKey, boardsWrap);

        function showHelp() {
          modal({
            title: "How to play",
            body: `<b>Goal:</b> find all <b>${boardCount} hidden five-letter words</b> within ${maxGuesses} guesses.<br><br>
              <b>How to play:</b><br>
              1. Type any real five-letter word and press Enter — it plays on <b>every board at once</b>.<br>
              2. Read the colors on each board separately:
              <span style="color:var(--good);font-weight:700">green</span> = right letter, right spot ·
              <span style="color:var(--near);font-weight:700">gold</span> = in that word, wrong spot ·
              gray = not in that word.<br>
              3. A solved board fades out; keep guessing for the rest.<br><br>
              <b>Tips:</b> open with vowel-rich words like RAISE or ADIEU; the on-screen
              keyboard remembers your best clue per letter. On a phone, tap the boards
              to open your keyboard.`,
          });
        }

        function paintRow(b, rowIdx, guess, marks) {
          const row = boardEls[b].children[rowIdx];
          for (let c = 0; c < WORD_LEN; c++) {
            const t = row.children[c];
            t.textContent = guess[c];
            t.classList.add(marks[c], "pop");
          }
        }

        function paintCurrent() {
          const rowIdx = guesses.length;
          if (rowIdx >= maxGuesses) return;
          for (let b = 0; b < boardCount; b++) {
            if (solvedAt[b] >= 0) continue;
            const row = boardEls[b].children[rowIdx];
            for (let c = 0; c < WORD_LEN; c++) {
              const t = row.children[c];
              t.textContent = current[c] || "";
              t.classList.toggle("filled", !!current[c]);
            }
          }
        }

        function onKey(key) {
          if (over) return;
          if (key === "Enter") return submit();
          if (key === "Backspace") { current = current.slice(0, -1); paintCurrent(); return; }
          if (/^[a-z]$/i.test(key) && current.length < WORD_LEN) {
            current += key.toLowerCase();
            paintCurrent();
          }
        }

        function submit() {
          if (current.length < WORD_LEN) return toast("Not enough letters");
          if (!VALID.has(current)) {
            boardsWrap.classList.remove("shake");
            void boardsWrap.offsetWidth;
            boardsWrap.classList.add("shake");
            return toast("Not in word list");
          }
          const rowIdx = guesses.length;
          guesses.push(current);
          for (let b = 0; b < boardCount; b++) {
            if (solvedAt[b] >= 0) continue;
            const marks = scoreGuess(current, answers[b]);
            paintRow(b, rowIdx, current, marks);
            for (let c = 0; c < WORD_LEN; c++) kbd.setState(current[c], marks[c]);
            if (current === answers[b]) {
              solvedAt[b] = rowIdx;
              boardEls[b].classList.add("solved");
            }
          }
          current = "";
          const solvedCount = solvedAt.filter((x) => x >= 0).length;
          status.textContent = `Guess ${Math.min(guesses.length + 1, maxGuesses)} of ${maxGuesses} — solved ${solvedCount}/${boardCount}`;
          if (solvedCount === boardCount) return finish(true);
          if (guesses.length >= maxGuesses) return finish(false);
        }

        function giveUp() {
          if (!over) finish(false);
        }

        function shareText(won) {
          const name = boardCount > 4 ? "Octo Grid" : "Quad Grid";
          const mark = { good: "🟩", near: "🟨", bad: "⬛" };
          const grids = answers.map((a, b) => {
            const upto = solvedAt[b] >= 0 ? solvedAt[b] : guesses.length - 1;
            return guesses.slice(0, upto + 1)
              .map((g) => scoreGuess(g, a).map((m) => mark[m]).join(""))
              .join("\n");
          }).join("\n\n");
          return `GoPlay ${name} ${won ? guesses.length : "X"}/${maxGuesses}\n\n${grids}`;
        }

        function finish(won) {
          over = true;
          LQ.sound(won ? "win" : "bad");
          recordResult(boardCount > 4 ? "octo" : "quad", { won, score: solvedAt.filter((x) => x >= 0).length });
          const reveal = answers
            .map((a, i) => `<b>${a.toUpperCase()}</b>${solvedAt[i] >= 0 ? " ✓" : " ✗"}`)
            .join(" · ");
          modal({
            title: won ? "🎉 All solved!" : "Out of guesses",
            body: `${reveal}<br><br>${won ? `Solved in ${guesses.length} guesses.` : "Better luck next time."}`,
            actions: [
              { label: "Play again", primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e6) + 1) },
              { label: "Share", onClick: () => LQ.share(shareText(won)) },
              { label: "Close" },
            ],
          });
        }

        function physicalKey(e) {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.key === "Enter" || e.key === "Backspace" || /^[a-z]$/i.test(e.key)) {
            e.preventDefault();
            onKey(e.key);
          }
        }
        document.addEventListener("keydown", physicalKey);
        return () => document.removeEventListener("keydown", physicalKey);
      }

      newRound(0);
      return () => { if (cleanup) cleanup(); };
    };
  }

  LQ.register({
    id: "quad",
    title: "Quad Grid",
    icon: "🟩",
    tagline: "Crack four hidden words at the same time in nine guesses.",
    render: makeGame(4, 9),
  });

  LQ.register({
    id: "octo",
    title: "Octo Grid",
    icon: "🐙",
    tagline: "The big one: eight hidden words, thirteen guesses. Good luck.",
    render: makeGame(8, 13),
  });
})();
