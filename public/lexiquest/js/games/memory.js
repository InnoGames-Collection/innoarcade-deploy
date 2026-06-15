/* Memory Matrix — memorize the flashed cells, then tap them back. */
(function () {
  "use strict";
  const { el, modal, recordResult, shuffled, statsRow, getStats } = LQ;

  const LIVES = 3;
  const FLASH_MS = 1100;

  function levelSpec(level) {
    const size = Math.min(3 + Math.floor((level - 1) / 3), 5);
    const targets = Math.min(3 + Math.floor((level - 1) / 2), Math.floor(size * size * 0.6));
    return { size, targets };
  }

  function render(mount) {
    let cleanup = null;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    function newRound() {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound();
    }

    function startRound() {
      let level = 1;
      let lives = LIVES;
      let over = false;

      const sub = el("p", { class: "sub center" });
      const scoreEl = el("div");
      const fb = el("div", { class: "quiz-feedback center" });
      const gridEl = el("div", { class: "grid-n" });

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "Restart", onclick: newRound })
      ));
      mount.appendChild(scoreEl);
      mount.appendChild(sub);
      mount.appendChild(gridEl);
      mount.appendChild(fb);
      nextLevel();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> climb as many levels as your memory allows.<br><br>
            <b>How to play:</b><br>
            1. A set of cells flashes <b>gold</b> for about a second — memorize their positions.<br>
            2. When they vanish, tap every one of them. Order doesn't matter.<br>
            3. Perfect recall advances you a level: more cells, bigger grids.<br>
            4. One wrong tap shows the real answer, costs a life, and replays the level —
            you have ${LIVES} lives.<br><br>
            <b>Tip:</b> don't memorize cells one by one — see them as a single
            <b>shape</b> (an L, a diagonal, a cluster). Shapes survive in memory; lists don't.`,
        });
      }

      function paintScore() {
        scoreEl.innerHTML = "";
        scoreEl.appendChild(statsRow([
          [level, "level"], ["❤️".repeat(lives) || "—", "lives"], [getStats("memory").best, "best"],
        ]));
      }

      function nextLevel() {
        if (over) return;
        const { size, targets } = levelSpec(level);
        const total = size * size;
        const targetSet = new Set(shuffled([...Array(total).keys()]).slice(0, targets));
        let found = 0;
        let accepting = false;

        sub.textContent = `Level ${level} — memorize ${targets} cells`;
        fb.textContent = "Watch carefully…";
        fb.className = "quiz-feedback center dim";
        gridEl.style.gridTemplateColumns = `repeat(${size}, var(--cell, 60px))`;
        gridEl.innerHTML = "";
        paintScore();

        const cells = [];
        for (let i = 0; i < total; i++) {
          const cell = el("div", {
            class: "trek-cell", role: "button", tabindex: "0",
            style: "--cell: " + (size === 5 ? "52px" : "60px"),
            onclick: () => tap(i),
            onkeydown: (e) => { if (e.key === "Enter") tap(i); },
          });
          cells.push(cell);
          gridEl.appendChild(cell);
        }

        // flash phase
        later(() => {
          targetSet.forEach((i) => cells[i].classList.add("flash"));
        }, 350);
        later(() => {
          cells.forEach((c) => c.classList.remove("flash"));
          accepting = true;
          fb.textContent = "Now tap them back!";
        }, 350 + FLASH_MS);

        function tap(i) {
          if (!accepting || over) return;
          const cell = cells[i];
          if (cell.classList.contains("good")) return;
          if (targetSet.has(i)) {
            cell.classList.add("good");
            found++;
            LQ.sound("good");
            if (found === targetSet.size) {
              accepting = false;
              level++;
              fb.textContent = "Perfect!";
              fb.className = "quiz-feedback good center";
              later(nextLevel, 900);
            }
          } else {
            accepting = false;
            cell.classList.add("bad");
            targetSet.forEach((t) => { if (!cells[t].classList.contains("good")) cells[t].classList.add("flash"); });
            lives--;
            LQ.sound("bad");
            paintScore();
            if (lives <= 0) { later(finish, 1100); }
            else {
              fb.textContent = "Oops — those were the cells. Try this level again.";
              fb.className = "quiz-feedback bad center";
              later(nextLevel, 1600);
            }
          }
        }
      }

      function finish() {
        if (over) return;
        over = true;
        const reached = level;
        const prevBest = getStats("memory").best;
        LQ.sound(reached > prevBest ? "win" : "bad");
        recordResult("memory", { won: reached >= 6, score: reached });
        modal({
          title: reached > prevBest ? "🧠 New best level!" : "Out of lives",
          body: `You reached <b>level ${reached}</b>.` +
            (reached > prevBest ? "" : `<br>Personal best: ${Math.max(prevBest, reached)}.`),
          actions: [
            { label: "Play again", primary: true, onClick: newRound },
            { label: "Close" },
          ],
        });
      }

      return () => timers.forEach(clearTimeout);
    }

    newRound();
    return () => {
      timers.forEach(clearTimeout);
      if (cleanup) cleanup();
    };
  }

  LQ.register({
    id: "memory",
    category: "analytical",
    title: "Memory Matrix",
    icon: "🧠",
    tagline: "Cells flash, then vanish. Tap them back from memory — levels keep growing.",
    render,
  });
})();
