/* The Missing Letter — type the letter missing from each word; the collected
   letters spell a secret word. */
(function () {
  "use strict";
  const { el, modal, typeCatcher, recordResult, dayNumber } = LQ;

  function render(mount) {
    let cleanup = null;

    function newRound(idx) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(idx);
    }

    function startRound(idx) {
      const sets = LQ_DATA.MISSING;
      const set = sets[((idx % sets.length) + sets.length) % sets.length];
      let round = 0;
      let mistakes = 0;
      let over = false;
      const collected = [];

      const clueEl = el("p", { class: "prompt" });
      const subEl = el("p", { class: "sub" });
      const wordEl = el("div", { class: "ml-word" });
      const fb = el("div", { class: "quiz-feedback center" });
      const secretEl = el("div", { class: "ml-secret" });
      const card = el("div", { class: "quiz-q" }, subEl, clueEl, wordEl, fb);

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New puzzle", onclick: () => newRound(idx + 1) })
      ));
      mount.appendChild(el("div", { class: "quiz-wrap" },
        el("p", { class: "center dim", text: "Secret word so far:" }),
        secretEl, card
      ));

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> solve all ${set.rounds.length} words and uncover the
            <b>secret word</b> their missing letters spell.<br><br>
            <b>How to play:</b><br>
            1. Read the clue in quotes — it describes the full word.<br>
            2. One tile is empty (blue border). Type the letter that belongs there —
            keyboard, on-screen keys, or tap the word card on a phone.<br>
            3. Each solved word adds its missing letter to the secret word at the top.<br><br>
            <b>Tip:</b> wrong guesses cost nothing — say the word in your head with
            different letters until one clicks.`,
        });
      }

      function paintSecret() {
        secretEl.innerHTML = "";
        for (let i = 0; i < set.secret.length; i++) {
          const t = el("div", { class: "tile small" + (collected[i] ? " good" : "") });
          t.textContent = collected[i] || "";
          secretEl.appendChild(t);
        }
      }

      function paintRound() {
        const r = set.rounds[round];
        subEl.textContent = `Word ${round + 1} of ${set.rounds.length}`;
        clueEl.textContent = "“" + r.clue + "”";
        fb.textContent = "Type the missing letter…";
        fb.className = "quiz-feedback center dim";
        wordEl.innerHTML = "";
        for (let i = 0; i < r.word.length; i++) {
          const t = el("div", { class: "tile" + (i === r.blank ? "" : " filled") });
          t.textContent = i === r.blank ? "" : r.word[i];
          if (i === r.blank) t.style.borderColor = "var(--accent)";
          wordEl.appendChild(t);
        }
        paintSecret();
      }

      function guess(letter) {
        if (over) return;
        const r = set.rounds[round];
        const want = r.word[r.blank];
        if (letter === want) {
          collected.push(want);
          wordEl.children[r.blank].textContent = want;
          wordEl.children[r.blank].classList.add("good", "pop");
          fb.textContent = `Yes — “${r.word}”!`;
          fb.className = "quiz-feedback good center";
          round++;
          paintSecret();
          if (round >= set.rounds.length) { setTimeout(finish, 700); }
          else setTimeout(paintRound, 900);
        } else {
          mistakes++;
          fb.textContent = `Not “${letter}” — try again.`;
          fb.className = "quiz-feedback bad center";
          wordEl.classList.remove("shake");
          void wordEl.offsetWidth;
          wordEl.classList.add("shake");
        }
      }

      function finish() {
        over = true;
        const won = mistakes <= set.rounds.length;
        recordResult("missing", { won, score: Math.max(0, set.rounds.length * 2 - mistakes) });
        modal({
          title: "🔎 Secret word: " + set.secret,
          body: `You solved all ${set.rounds.length} words with <b>${mistakes}</b> wrong
            guess${mistakes === 1 ? "" : "es"}.<br><br>The missing letters spelled
            <b>${set.secret}</b>!`,
          actions: [
            { label: "Next puzzle", primary: true, onClick: () => newRound(idx + 1) },
            { label: "Close" },
          ],
        });
      }

      function physicalKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); guess(e.key.toLowerCase()); }
      }
      document.addEventListener("keydown", physicalKey);

      // on-screen letter buttons for touch devices
      const kbd = LQ.keyboard((key) => { if (/^[a-z]$/.test(key)) guess(key); });
      mount.appendChild(kbd.element);
      // tapping the word card opens the phone's own keyboard as an alternative
      typeCatcher((key) => { if (/^[a-z]$/.test(key)) guess(key); }, card);

      paintRound();
      return () => document.removeEventListener("keydown", physicalKey);
    }

    newRound(dayNumber());
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "missing",
    title: "The Missing Letter",
    icon: "🔎",
    tagline: "Find each word's missing letter — together they spell a secret word.",
    render,
  });
})();
