/* Make 24 — combine four numbers with + − × ÷ to reach exactly 24. */
(function () {
  "use strict";
  const { el, toast, modal, recordResult, mulberry32, dayNumber, randInt, statsRow } = LQ;

  const TARGET = 24;
  const ROUNDS = 5;
  const EPS = 1e-9;

  // solver: can `nums` reach target? also returns one solution string
  function solve(nums, exprs) {
    exprs = exprs || nums.map(String);
    if (nums.length === 1) {
      return Math.abs(nums[0] - TARGET) < EPS ? exprs[0] : null;
    }
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const rest = nums.filter((_, k) => k !== i && k !== j);
        const restE = exprs.filter((_, k) => k !== i && k !== j);
        const a = nums[i], b = nums[j], ea = exprs[i], eb = exprs[j];
        const ops = [
          [a + b, `(${ea}+${eb})`],
          [a - b, `(${ea}-${eb})`],
          [a * b, `(${ea}×${eb})`],
        ];
        if (Math.abs(b) > EPS) ops.push([a / b, `(${ea}÷${eb})`]);
        for (const [v, e] of ops) {
          const r = solve(rest.concat([v]), restE.concat([e]));
          if (r) return r;
        }
      }
    }
    return null;
  }

  function generate(rnd) {
    for (;;) {
      const nums = [0, 0, 0, 0].map(() => randInt(1, 9, rnd));
      if (solve(nums)) return nums;
    }
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
      let round = 0;
      let solvedCount = 0;
      let nums = [];        // [{val, label, used}]
      let history = [];     // snapshots for undo
      let selIdx = -1;
      let selOp = null;

      const sub = el("p", { class: "sub center" });
      const chips = el("div", { class: "chips" });
      const fb = el("div", { class: "quiz-feedback center" });
      const ops = el("div", { class: "op-row" });
      const opEls = {};
      for (const [sym, fn] of [["+", (a, b) => a + b], ["−", (a, b) => a - b], ["×", (a, b) => a * b], ["÷", (a, b) => b === 0 ? null : a / b]]) {
        const b = el("button", { class: "op-btn", text: sym, "aria-label": sym, onclick: () => pickOp(sym) });
        opEls[sym] = { btn: b, fn };
        ops.appendChild(b);
      }

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "Undo", onclick: undo }),
        el("button", { class: "btn", text: "Show solution", onclick: revealSolution }),
        el("button", { class: "btn", text: "New game", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
      ));
      mount.appendChild(el("div", { class: "quiz-wrap" },
        el("div", { class: "quiz-q" }, sub, chips, ops, fb)
      ));
      nextRound();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> combine all four numbers into exactly <b>${TARGET}</b>.
            Every puzzle is guaranteed solvable.<br><br>
            <b>How to play:</b><br>
            1. Tap a number — it highlights.<br>
            2. Tap an operation (+ − × ÷), then a second number.<br>
            3. The two numbers <b>merge into their result</b>. Keep combining until one
            number remains — if it's ${TARGET}, you win the puzzle.<br><br>
            <b>Example:</b> 4, 6, 2, 2 → 2÷2=1 → 4×6=24 → 24×1=<b>24</b> ✓<br><br>
            <b>Tips:</b> aim for the factor pairs of 24 (3×8, 4×6, 2×12); Undo rolls back
            one step; Show solution reveals an answer but skips the puzzle.`,
        });
      }

      function nextRound() {
        if (round >= ROUNDS) return finish();
        const vals = generate(rnd);
        nums = vals.map((v) => ({ val: v, label: String(v), used: false }));
        history = [];
        selIdx = -1; selOp = null;
        sub.textContent = `Puzzle ${round + 1} of ${ROUNDS} — make ${TARGET}`;
        fb.textContent = "Tap number · operation · number";
        fb.className = "quiz-feedback center dim";
        paint();
      }

      function paint() {
        chips.innerHTML = "";
        nums.forEach((n, i) => {
          if (n.used) return;
          chips.appendChild(el("button", {
            class: "num-chip" + (i === selIdx ? " sel" : ""),
            text: n.label,
            onclick: () => pickNum(i),
          }));
        });
        for (const k of Object.keys(opEls)) {
          opEls[k].btn.classList.toggle("sel", selOp === k);
        }
      }

      function pickNum(i) {
        if (selIdx === -1 || selOp === null) {
          selIdx = i; selOp = null;
          paint();
          return;
        }
        if (i === selIdx) { selIdx = -1; selOp = null; paint(); return; }
        const a = nums[selIdx], b = nums[i];
        const v = opEls[selOp].fn(a.val, b.val);
        if (v === null) { LQ.sound("bad"); toast("Can't divide by zero"); return; }
        history.push(nums.map((n) => ({ ...n })));
        a.used = true; b.used = true;
        const pretty = Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
        nums.push({ val: v, label: pretty, used: false });
        selIdx = -1; selOp = null;
        paint();
        const left = nums.filter((n) => !n.used);
        if (left.length === 1) {
          if (Math.abs(left[0].val - TARGET) < EPS) {
            LQ.sound("win");
            solvedCount++;
            round++;
            fb.textContent = `🎯 ${TARGET}! Nailed it.`;
            fb.className = "quiz-feedback good center";
            setTimeout(nextRound, 1100);
          } else {
            LQ.sound("bad");
            fb.textContent = `That's ${left[0].label}, not ${TARGET} — undo and retry.`;
            fb.className = "quiz-feedback bad center";
          }
        }
      }

      function pickOp(sym) {
        if (selIdx === -1) { toast("Pick a number first"); return; }
        selOp = sym;
        paint();
      }

      function undo() {
        if (!history.length) return toast("Nothing to undo");
        nums = history.pop();
        selIdx = -1; selOp = null;
        fb.textContent = "Tap number · operation · number";
        fb.className = "quiz-feedback center dim";
        paint();
      }

      function revealSolution() {
        const base = (history.length ? history[0] : nums).filter((n) => !n.used).map((n) => n.val);
        const sol = solve(base);
        modal({
          title: "One solution",
          body: `<b>${sol ? sol.replace(/^\((.*)\)$/, "$1") + " = " + TARGET : "—"}</b><br><br>This puzzle counts as skipped.`,
          actions: [{ label: "Next puzzle", primary: true, onClick: () => { round++; nextRound(); } }],
        });
      }

      function finish() {
        const won = solvedCount >= Math.ceil(ROUNDS * 0.6);
        LQ.sound(won ? "win" : "bad");
        recordResult("target24", { won, score: solvedCount });
        mount.querySelector(".quiz-q").innerHTML = "";
        mount.querySelector(".quiz-q").append(
          el("p", { class: "prompt", text: solvedCount === ROUNDS ? "🎯 Perfect round!" : `You solved ${solvedCount} of ${ROUNDS}` }),
          statsRow([[solvedCount, "solved"], [ROUNDS, "puzzles"]]),
          el("div", { class: "mt" },
            el("button", { class: "btn primary", text: "Play again", onclick: () => newRound(Math.floor(Math.random() * 1e9)) })
          )
        );
      }
    }

    newRound(dayNumber() * 379 + 5);
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "target24",
    category: "numerical",
    title: "Make 24",
    icon: "🎯",
    tagline: "Combine four numbers with + − × ÷ to hit exactly 24.",
    render,
  });
})();
