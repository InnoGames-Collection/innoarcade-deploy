/* Petal Power — build words from seven letters, always using the center letter. */
(function () {
  "use strict";
  const { el, toast, modal, typeCatcher, recordResult, dayNumber, statsRow } = LQ;

  const PUZZLES = LQ_DATA.PETALS;

  function wordScore(w, lettersSet) {
    if (w.length === 4) return 2;
    let pts = w.length; // 5+ letters: 1 pt per letter
    if (new Set(w).size === 7 && [...w].every((c) => lettersSet.has(c))) pts += 7; // pangram
    return pts;
  }

  function render(mount) {
    let cleanup = null;

    function newRound(idx) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(idx);
    }

    function startRound(idx) {
      const puzzle = PUZZLES[((idx % PUZZLES.length) + PUZZLES.length) % PUZZLES.length];
      const center = puzzle.center;
      const outer = puzzle.outer.slice();
      const lettersSet = new Set([center, ...outer]);
      const validWords = new Set(puzzle.words);
      const maxScore = puzzle.words.reduce((s, w) => s + wordScore(w, lettersSet), 0);
      const targets = [
        Math.round(maxScore * 0.1), Math.round(maxScore * 0.25),
        Math.round(maxScore * 0.45), Math.round(maxScore * 0.7),
      ];
      const ranks = ["Sprout", "Bud", "Bloom", "Bouquet", "Full Garden"];

      const found = [];
      let score = 0;
      let current = "";
      let over = false;

      // --- flower DOM: center + 6 petals around ---
      const flower = el("div", { class: "flower" });
      const R = 108, CX = 150, CY = 150, SZ = 84;
      const centerBtn = el("button", {
        class: "petal center", text: center,
        style: `left:${CX - SZ / 2}px; top:${CY - SZ / 2}px;`,
        onclick: () => addLetter(center),
      });
      flower.appendChild(centerBtn);
      outer.forEach((ltr, i) => {
        const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const x = CX + R * Math.cos(ang) - SZ / 2;
        const y = CY + R * Math.sin(ang) - SZ / 2;
        // read the letter from the element so Shuffle stays in sync
        flower.appendChild(el("button", {
          class: "petal", text: ltr, "data-l": ltr,
          style: `left:${x}px; top:${y}px;`,
          onclick: (e) => addLetter(e.currentTarget.dataset.l),
        }));
      });

      const entry = el("div", { class: "word-entry" });
      const scoreEl = el("div");
      const rankEl = el("div", { class: "center dim" });
      const foundWrap = el("div", { class: "found-words" });

      const toolbar = el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "Shuffle", onclick: shufflePetals }),
        el("button", { class: "btn", text: "Delete", onclick: () => { current = current.slice(0, -1); paint(); } }),
        el("button", { class: "btn primary", text: "Submit", onclick: submit }),
        el("button", { class: "btn", text: "Finish", onclick: () => finish() })
      );

      mount.appendChild(scoreEl);
      mount.appendChild(rankEl);
      mount.appendChild(entry);
      mount.appendChild(flower);
      mount.appendChild(toolbar);
      mount.appendChild(foundWrap);
      paint();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> reach <b>${targets[2]} points</b> (your GOAL) — push on to
            ${targets[3]} for a Full Garden (max ${maxScore}).<br><br>
            <b>How to play:</b><br>
            1. Build words of <b>4+ letters</b> using only the seven petals — tap them or
            type; on a phone, tap the word line above the flower to open your keyboard.<br>
            2. Every word must contain the gold <b>center letter</b>. Letters may be
            reused within a word.<br>
            3. Press Enter or Submit to score it.<br><br>
            <b>Scoring:</b> 4-letter word = 2 pts · longer words = 1 pt per letter ·
            a word using <b>all seven letters</b> (a pangram) earns +7.<br><br>
            <b>Tips:</b> stretch words with endings like -ED, -ING, -ER; Shuffle rearranges
            the petals for fresh eyes; Finish ends the round and reveals missed words.`,
        });
      }

      function rankFor(s) {
        let r = 0;
        for (let i = 0; i < targets.length; i++) if (s >= targets[i]) r = i + 1;
        return ranks[r];
      }

      function paint() {
        entry.innerHTML = "";
        for (const ch of current) {
          entry.appendChild(el("span", { class: ch === center ? "req" : "", text: ch }));
        }
        scoreEl.innerHTML = "";
        scoreEl.appendChild(statsRow([[score, "score"], [found.length, "words"], [targets[2], "goal"]]));
        rankEl.textContent = "Rank: " + rankFor(score);
      }

      function addLetter(ltr) {
        if (over) return;
        if (current.length >= 12) return;
        current += ltr;
        paint();
      }

      function shufflePetals() {
        const petals = [...flower.querySelectorAll(".petal:not(.center)")];
        const letters = LQ.shuffled(petals.map((p) => p.dataset.l));
        petals.forEach((p, i) => {
          p.dataset.l = letters[i];
          p.textContent = letters[i];
        });
      }

      function submit() {
        if (over) return;
        const w = current;
        current = "";
        if (w.length < 4) { paint(); LQ.sound("bad"); return toast("Words need at least 4 letters"); }
        if (!w.includes(center)) { paint(); LQ.sound("bad"); return toast("Must use the center letter"); }
        if (found.includes(w)) { paint(); LQ.sound("bad"); return toast("Already found"); }
        if (!validWords.has(w)) { paint(); LQ.sound("bad"); return toast("Not in word list"); }
        LQ.sound("good");
        const pts = wordScore(w, lettersSet);
        const isPangram = new Set(w).size === 7;
        found.push(w);
        score += pts;
        foundWrap.prepend(el("span", { class: "chip" + (isPangram ? " pangram" : ""), text: w + " +" + pts }));
        toast(isPangram ? `🌼 PANGRAM! +${pts}` : `+${pts}`);
        paint();
        if (score >= maxScore) finish();
      }

      function finish() {
        if (over) return;
        over = true;
        recordResult("petals", { won: score >= targets[2], score });
        modal({
          title: "🌼 " + rankFor(score) + "!",
          body: `You scored <b>${score}</b> of ${maxScore} points with ${found.length} words.<br><br>
            Words you missed: ${puzzle.words.filter((w) => !found.includes(w)).slice(0, 18).join(", ") || "none!"}`,
          actions: [
            { label: "New flower", primary: true, onClick: () => newRound(Math.floor(Math.random() * PUZZLES.length * 97)) },
            { label: "Close" },
          ],
        });
      }

      function physicalKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        else if (e.key === "Backspace") { e.preventDefault(); current = current.slice(0, -1); paint(); }
        else if (/^[a-z]$/i.test(e.key) && lettersSet.has(e.key.toLowerCase())) {
          e.preventDefault(); addLetter(e.key.toLowerCase());
        }
      }
      document.addEventListener("keydown", physicalKey);
      typeCatcher((key) => {
        if (key === "Enter") return submit();
        if (key === "Backspace") { current = current.slice(0, -1); paint(); return; }
        if (lettersSet.has(key)) addLetter(key);
      }, entry);
      return () => document.removeEventListener("keydown", physicalKey);
    }

    newRound(dayNumber());
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "petals",
    title: "Petal Power",
    icon: "🌼",
    tagline: "Grow words from seven petals — the center letter is always required.",
    render,
  });
})();
