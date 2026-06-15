/* Rhyme Twins — every answer is a pair of rhyming words. */
(function () {
  "use strict";
  const { el, toast, modal, typeCatcher, recordResult, dayNumber, shuffled, mulberry32 } = LQ;

  const MAX_TRIES = 4;

  function render(mount) {
    let cleanup = null;

    function newRound(seed) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(seed);
    }

    function startRound(seed) {
      const rnd = mulberry32(seed);
      const order = shuffled(LQ_DATA.RHYME, rnd);
      let qIdx = 0;
      let solved = 0;
      const TOTAL = 5;

      const wrap = el("div", { class: "quiz-wrap" });
      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New set", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
      ));
      mount.appendChild(wrap);

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> solve ${TOTAL} riddles where every answer is a pair of
            <b>rhyming words</b> — “an overweight feline” → <b>FAT CAT</b>.<br><br>
            <b>How to play:</b><br>
            1. Read the clue; the tiles show how long each word is.<br>
            2. Type the first word, then the second — typing flows into the next word
            automatically. On a phone, tap the tiles to open your keyboard.<br>
            3. Press Enter or Guess. You get ${MAX_TRIES} tries per riddle.<br><br>
            <b>Stuck?</b> Hint reveals both first letters (once per riddle);
            Reveal shows the answer and moves on. Solve 3 of ${TOTAL} to win the set.`,
        });
      }

      function nextRiddle() {
        if (qIdx >= TOTAL) return finish();
        const item = order[qIdx % order.length];
        let tries = 0;
        let hinted = false;

        const fb = el("div", { class: "quiz-feedback center" });
        const slots = el("div", { class: "rhyme-slots" });
        const inputs = [];
        [item.w1, item.w2].forEach((w) => {
          const slot = el("div", { class: "rhyme-slot" });
          const cells = [];
          for (let i = 0; i < w.length; i++) {
            const t = el("div", { class: "tile small" });
            cells.push(t);
            slot.appendChild(t);
          }
          inputs.push({ word: w, cells, typed: "" });
          slots.appendChild(slot);
        });
        let active = 0;

        const card = el("div", { class: "quiz-q" },
          el("p", { class: "sub", text: `Riddle ${qIdx + 1} of ${TOTAL} · ${MAX_TRIES} tries` }),
          el("p", { class: "prompt", text: "“" + item.clue + "”" }),
          slots,
          el("p", { class: "sub center dim", text: "Tap the tiles to type" }),
          el("div", { class: "game-toolbar" },
            el("button", { class: "btn", text: "Hint", onclick: useHint }),
            el("button", { class: "btn primary", text: "Guess", onclick: submit }),
            el("button", { class: "btn", text: "Reveal", onclick: () => reveal(false) })
          ),
          fb
        );
        wrap.innerHTML = "";
        wrap.appendChild(card);
        paint();

        function paint() {
          inputs.forEach((inp, i) => {
            inp.cells.forEach((c, j) => {
              c.textContent = inp.typed[j] || "";
              c.classList.toggle("filled", !!inp.typed[j]);
            });
          });
        }

        function useHint() {
          if (hinted) return toast("Hint already used");
          hinted = true;
          inputs.forEach((inp) => {
            inp.typed = inp.word[0];
            inp.cells[0].textContent = inp.word[0];
            inp.cells[0].classList.add("near");
          });
          active = 0;
          paint();
          toast("First letters revealed");
        }

        function submit() {
          const g1 = inputs[0].typed, g2 = inputs[1].typed;
          if (g1.length < inputs[0].word.length || g2.length < inputs[1].word.length) {
            return toast("Fill in both words");
          }
          if (g1 === item.w1 && g2 === item.w2) {
            inputs.forEach((inp) => inp.cells.forEach((c) => c.classList.add("good", "pop")));
            fb.textContent = "Got it! " + item.w1.toUpperCase() + " " + item.w2.toUpperCase();
            fb.className = "quiz-feedback good center";
            solved++;
            qIdx++;
            setTimeout(nextRiddle, 1100);
          } else {
            tries++;
            slots.classList.remove("shake");
            void slots.offsetWidth;
            slots.classList.add("shake");
            if (tries >= MAX_TRIES) return reveal(true);
            fb.textContent = `Not quite — ${MAX_TRIES - tries} tries left.`;
            fb.className = "quiz-feedback bad center";
            inputs.forEach((inp) => { inp.typed = hinted ? inp.word[0] : ""; });
            active = 0;
            paint();
          }
        }

        function reveal(exhausted) {
          inputs.forEach((inp) => {
            inp.typed = inp.word;
            inp.cells.forEach((c, j) => { c.textContent = inp.word[j]; c.classList.add("bad"); });
          });
          fb.textContent = (exhausted ? "Out of tries! " : "") +
            "It was: " + item.w1.toUpperCase() + " " + item.w2.toUpperCase();
          fb.className = "quiz-feedback bad center";
          qIdx++;
          setTimeout(nextRiddle, 1600);
        }

        function handleKey(key) {
          if (key === "Enter") return submit();
          if (key === "Backspace") {
            const inp = inputs[active];
            const min = hinted ? 1 : 0;
            if (inp.typed.length > min) inp.typed = inp.typed.slice(0, -1);
            else if (active > 0) active--;
            paint();
            return;
          }
          if (/^[a-z]$/.test(key)) {
            const inp = inputs[active];
            if (inp.typed.length < inp.word.length) inp.typed += key;
            if (inp.typed.length === inp.word.length && active < inputs.length - 1) active++;
            paint();
          }
        }

        card._onKey = function (e) {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.key === "Enter" || e.key === "Backspace" || /^[a-z]$/i.test(e.key)) {
            e.preventDefault();
            handleKey(e.key.length === 1 ? e.key.toLowerCase() : e.key);
          }
        };
        typeCatcher(handleKey, slots);
      }

      function finish() {
        recordResult("rhyme", { won: solved >= Math.ceil(TOTAL * 0.6), score: solved });
        wrap.innerHTML = "";
        wrap.appendChild(el("div", { class: "quiz-q" },
          el("p", { class: "prompt", text: solved === TOTAL ? "🎶 Perfect rhymer!" : `You solved ${solved} of ${TOTAL}` }),
          el("div", { class: "mt" },
            el("button", { class: "btn primary", text: "Play again", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
          )
        ));
      }

      function physicalKey(e) {
        const card = wrap.querySelector(".quiz-q");
        if (card && card._onKey) card._onKey(e);
      }
      document.addEventListener("keydown", physicalKey);
      nextRiddle();
      return () => document.removeEventListener("keydown", physicalKey);
    }

    newRound(dayNumber() * 31 + 7);
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "rhyme",
    title: "Rhyme Twins",
    icon: "🎶",
    tagline: "Every answer is a pair of words that rhyme. Crack the riddle.",
    render,
  });
})();
