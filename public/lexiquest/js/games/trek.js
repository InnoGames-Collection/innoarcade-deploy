/* Word Trek — trace paths through a 4x4 letter grid to find words. */
(function () {
  "use strict";
  const { el, toast, modal, recordResult, mulberry32, dayNumber, statsRow } = LQ;

  const SIZE = 4;
  const ROUND_SECONDS = 120;
  // Classic 16-dice distribution for friendly letter mixes
  const DICE = [
    "aaeegn", "abbjoo", "achops", "affkps",
    "aoottw", "cimotu", "deilrx", "delrvy",
    "distty", "eeghnw", "eeinsu", "ehrtvw",
    "eiosst", "elrtty", "himnuq", "hlnnrz",
  ];
  const DICT = new Set(LQ_DATA.TREK);

  function neighbors(i) {
    const r = Math.floor(i / SIZE), c = i % SIZE, out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
      }
    }
    return out;
  }

  function pointsFor(w) {
    return [0, 0, 0, 1, 1, 2, 3, 5][w.length] || 8;
  }

  function render(mount) {
    let cleanup = null;

    function newRound(seed) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(seed);
    }

    function startRound(seed) {
      const rnd = mulberry32(seed);
      // roll the dice into a grid
      const dice = DICE.slice();
      for (let i = dice.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [dice[i], dice[j]] = [dice[j], dice[i]];
      }
      const grid = dice.map((d) => d[Math.floor(rnd() * d.length)]);

      let path = [];
      const found = [];
      let score = 0;
      let secondsLeft = ROUND_SECONDS;
      let over = false;

      const statusEl = el("div", { class: "trek-status" });
      const scoreEl = el("div");
      const gridEl = el("div", { class: "trek-grid" });
      const foundWrap = el("div", { class: "found-words" });
      const cells = grid.map((ltr, i) => {
        const cell = el("div", { class: "trek-cell", text: ltr === "q" ? "qu" : ltr, onclick: () => tap(i) });
        gridEl.appendChild(cell);
        return cell;
      });

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "Clear", onclick: clearPath }),
        el("button", { class: "btn primary", text: "Submit word", onclick: submit }),
        el("button", { class: "btn", text: "New grid", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
      ));
      mount.appendChild(scoreEl);
      mount.appendChild(statusEl);
      mount.appendChild(gridEl);
      mount.appendChild(foundWrap);

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> score 10+ points before the ${ROUND_SECONDS / 60}-minute
            clock runs out.<br><br>
            <b>How to play:</b><br>
            1. Tap letters that touch each other (sideways or <b>diagonally</b>) to
            trace a word of 3+ letters — your word builds at the top.<br>
            2. Tap a selected tile again to backtrack to it; Clear (or Esc) starts over.<br>
            3. Tap Submit (or Enter) to score the word. Each tile may be used once
            per word; “Qu” counts as two letters.<br><br>
            <b>Scoring:</b> 3-4 letters = 1 pt · 5 = 2 · 6 = 3 · 7 = 5 pts.<br><br>
            <b>Tips:</b> hunt plurals (-S) and past tenses (-ED) of words you already
            found; common letters like E, S, T anchor long chains.`,
        });
      }

      function wordFromPath() {
        return path.map((i) => (grid[i] === "q" ? "qu" : grid[i])).join("");
      }

      function paint() {
        cells.forEach((c, i) => {
          c.classList.toggle("sel", path.includes(i));
          const last = path[path.length - 1];
          const usable = !path.length || (neighbors(last).includes(i) && !path.includes(i)) || path.includes(i);
          c.classList.toggle("dim", !over && path.length > 0 && !usable);
        });
        statusEl.textContent = wordFromPath();
        scoreEl.innerHTML = "";
        scoreEl.appendChild(statsRow([
          [score, "score"], [found.length, "words"],
          [Math.floor(secondsLeft / 60) + ":" + String(secondsLeft % 60).padStart(2, "0"), "time"],
        ]));
      }

      function tap(i) {
        if (over) return;
        const idx = path.indexOf(i);
        if (idx >= 0) { path = path.slice(0, idx); paint(); return; } // backtrack to before tile
        const last = path[path.length - 1];
        if (path.length && !neighbors(last).includes(i)) return toast("Pick an adjacent tile");
        path.push(i);
        paint();
      }

      function clearPath() { path = []; paint(); }

      function submit() {
        if (over) return;
        const w = wordFromPath();
        if (w.length < 3) return toast("3+ letters needed");
        if (found.includes(w)) { clearPath(); return toast("Already found"); }
        if (!DICT.has(w)) {
          gridEl.classList.remove("shake");
          void gridEl.offsetWidth;
          gridEl.classList.add("shake");
          return toast("Not in word list");
        }
        const pts = pointsFor(w);
        found.push(w);
        score += pts;
        foundWrap.prepend(el("span", { class: "chip", text: w + " +" + pts }));
        toast("+" + pts);
        clearPath();
      }

      const timer = setInterval(() => {
        if (over) return;
        secondsLeft--;
        if (secondsLeft <= 0) { finish(); return; }
        paint();
      }, 1000);

      function finish() {
        over = true;
        clearInterval(timer);
        secondsLeft = 0;
        paint();
        recordResult("trek", { won: score >= 10, score });
        modal({
          title: "⏱️ Time's up!",
          body: `You found <b>${found.length} words</b> for <b>${score} points</b>.` +
            (score >= 10 ? "<br><br>Trek complete — 10+ points! 🏔️" : "<br><br>Reach 10 points to complete the trek."),
          actions: [
            { label: "New grid", primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e9)) },
            { label: "Close" },
          ],
        });
      }

      function physicalKey(e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); clearPath(); }
      }
      document.addEventListener("keydown", physicalKey);

      paint();
      return () => {
        clearInterval(timer);
        document.removeEventListener("keydown", physicalKey);
      };
    }

    newRound(dayNumber() * 104729);
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "trek",
    title: "Word Trek",
    icon: "🏔️",
    tagline: "Trace paths through the letter grid and rack up words before time runs out.",
    render,
  });
})();
