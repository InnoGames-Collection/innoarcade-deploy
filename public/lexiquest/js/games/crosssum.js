/* Nine Sums — place digits 1-9 once each so every row and column hits its sum. */
(function () {
  "use strict";
  const { el, toast, modal, recordResult, mulberry32, dayNumber, shuffled } = LQ;

  function render(mount) {
    let cleanup = null;

    function newRound(seed) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(seed);
    }

    function startRound(seed) {
      const rnd = mulberry32(seed);
      const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
      const target = [];           // 3x3 solution
      for (let r = 0; r < 3; r++) target.push(digits.slice(r * 3, r * 3 + 3));
      const rowSums = target.map((row) => row.reduce((a, b) => a + b, 0));
      const colSums = [0, 1, 2].map((c) => target[0][c] + target[1][c] + target[2][c]);

      const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      let sel = null;
      let over = false;

      // grid with sum labels: 4x4 (last col/row are labels)
      const gridEl = el("div", {
        class: "sudoku", role: "grid",
        style: "grid-template-columns: repeat(4, auto);",
      });
      const cellEls = [];
      for (let r = 0; r < 3; r++) {
        cellEls.push([]);
        for (let c = 0; c < 3; c++) {
          const cell = el("div", {
            class: "cell", role: "gridcell",
            onclick: () => { if (!over) { sel = [r, c]; paint(); } },
          });
          cellEls[r].push(cell);
          gridEl.appendChild(cell);
        }
        gridEl.appendChild(el("div", { class: "cell sum-lbl", text: "→" + rowSums[r] }));
      }
      for (let c = 0; c < 3; c++) gridEl.appendChild(el("div", { class: "cell sum-lbl", text: "↓" + colSums[c] }));
      gridEl.appendChild(el("div", { class: "cell sum-lbl", text: "" }));

      const fb = el("div", { class: "quiz-feedback center" });
      const padWrap = el("div", { class: "kbd" },
        el("div", { class: "kbd-row" },
          [1, 2, 3, 4, 5].map(mkKey)),
        el("div", { class: "kbd-row" },
          [6, 7, 8, 9].map(mkKey),
          el("button", { class: "key wide", text: "⌫", onclick: () => place(0) })
        )
      );
      function mkKey(v) {
        return el("button", { class: "key num", text: String(v), onclick: () => place(v) });
      }

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New puzzle", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
      ));
      mount.appendChild(gridEl);
      mount.appendChild(fb);
      mount.appendChild(padWrap);
      paint();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> place the digits <b>1-9, each exactly once</b>, so every row
            adds up to its → number and every column to its ↓ number.<br><br>
            <b>How to play:</b><br>
            1. Tap a cell, then tap (or type) a digit.<br>
            2. Placing a digit that's already on the board <b>moves</b> it to the new cell.<br>
            3. Fill all nine cells — if all six sums match, you win. Any valid
            arrangement counts.<br><br>
            <b>Tips:</b> all nine digits add to 45, so the three row sums always total 45 —
            same for columns. Start with the smallest sum (it needs small digits) and the
            largest (it needs 7, 8, 9 territory).`,
        });
      }

      function paint() {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const cell = cellEls[r][c];
          cell.textContent = board[r][c] ? String(board[r][c]) : "";
          cell.classList.toggle("sel", !!sel && sel[0] === r && sel[1] === c);
        }
      }

      function place(v) {
        if (over) return;
        if (!sel) return toast("Tap a cell first");
        if (v) {
          // a digit can live in only one cell — clear it from elsewhere
          for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
            if (board[r][c] === v) board[r][c] = 0;
          }
          LQ.sound("click");
        }
        board[sel[0]][sel[1]] = v;
        paint();
        check();
      }

      function check() {
        const flat = board.flat();
        if (flat.includes(0)) return;
        const ok =
          board.every((row, r) => row.reduce((a, b) => a + b, 0) === rowSums[r]) &&
          [0, 1, 2].every((c) => board[0][c] + board[1][c] + board[2][c] === colSums[c]);
        if (ok) {
          over = true;
          LQ.sound("win");
          recordResult("crosssum", { won: true, score: 10 });
          modal({
            title: "🎉 All sums match!",
            body: "Nine digits, six sums, zero mistakes.",
            actions: [
              { label: "New puzzle", primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e9)) },
              { label: "Close" },
            ],
          });
        } else {
          LQ.sound("bad");
          fb.textContent = "All cells filled, but the sums don't match yet.";
          fb.className = "quiz-feedback bad center";
          setTimeout(() => { fb.textContent = ""; }, 2000);
        }
      }

      function physicalKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); place(Number(e.key)); }
        if (e.key === "Backspace" || e.key === "0") { e.preventDefault(); place(0); }
      }
      document.addEventListener("keydown", physicalKey);
      return () => document.removeEventListener("keydown", physicalKey);
    }

    newRound(dayNumber() * 911 + 1);
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "crosssum",
    category: "math",
    title: "Nine Sums",
    icon: "➕",
    tagline: "Place 1-9 exactly once so every row and column hits its target sum.",
    render,
  });
})();
