/* Equation Grid — guess the hidden 8-character equation (Nerdle-style). */
(function () {
  "use strict";
  const { el, toast, modal, recordResult, mulberry32, dayNumber } = LQ;

  const LEN = 8;
  const MAX_GUESSES = 6;
  const CHARS = "0123456789+-*/=";

  // --- tiny arithmetic evaluator (no eval), standard precedence ---
  function evaluate(expr) {
    if (!/^[0-9+\-*/]+$/.test(expr)) return null;
    const tokens = expr.match(/(\d+|[+\-*/])/g);
    if (!tokens || tokens.join("") !== expr) return null;
    // must alternate number, op, number, ...
    if (tokens.length % 2 === 0) return null;
    for (let i = 0; i < tokens.length; i++) {
      const isNum = /^\d+$/.test(tokens[i]);
      if (i % 2 === 0 && !isNum) return null;
      if (i % 2 === 1 && isNum) return null;
      if (isNum && tokens[i].length > 1 && tokens[i][0] === "0") return null; // leading zero
    }
    // pass 1: * and /
    const stack = [Number(tokens[0])];
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i], n = Number(tokens[i + 1]);
      if (op === "*") stack[stack.length - 1] *= n;
      else if (op === "/") {
        if (n === 0) return null;
        stack[stack.length - 1] /= n;
      } else stack.push(op === "-" ? -n : n);
    }
    return stack.reduce((a, b) => a + b, 0);
  }

  function validEquation(s) {
    if (s.length !== LEN) return false;
    const parts = s.split("=");
    if (parts.length !== 2) return false;
    const [lhs, rhs] = parts;
    if (!/^\d+$/.test(rhs)) return false;
    if (rhs.length > 1 && rhs[0] === "0") return false;
    const v = evaluate(lhs);
    return v !== null && Math.abs(v - Number(rhs)) < 1e-9;
  }

  function generate(rnd) {
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    for (let tries = 0; tries < 4000; tries++) {
      let s;
      switch (ri(0, 4)) {
        case 0: { const a = ri(10, 89), b = ri(10, 89); s = `${a}+${b}=${a + b}`; break; }
        case 1: { const a = ri(30, 99), b = ri(10, a - 10); s = `${a}-${b}=${a - b}`; break; }
        case 2: { const a = ri(2, 9), b = ri(12, 99); s = `${a}*${b}=${a * b}`; break; }
        case 3: { const b = ri(2, 9), c = ri(12, 99); s = `${b * c}/${b}=${c}`; break; }
        default: { const a = ri(1, 9), b = ri(1, 9), c = ri(1, 9); s = `${a}+${b}*${c}=${a + b * c}`; break; }
      }
      if (s.length === LEN && validEquation(s)) return s;
    }
    return "12+35=47";
  }

  function scoreGuess(guess, answer) {
    const res = new Array(LEN).fill("bad");
    const remaining = {};
    for (let i = 0; i < LEN; i++) {
      if (guess[i] === answer[i]) res[i] = "good";
      else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < LEN; i++) {
      if (res[i] === "good") continue;
      if (remaining[guess[i]] > 0) { res[i] = "near"; remaining[guess[i]]--; }
    }
    return res;
  }

  function render(mount) {
    let cleanup = null;

    function newRound(seedOffset) {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound(seedOffset);
    }

    function startRound(seedOffset) {
      const rnd = mulberry32(dayNumber() * 2477 + (seedOffset || 0));
      const answer = generate(rnd);
      const guesses = [];
      let current = "";
      let over = false;

      const board = el("div", { class: "eq-board" });
      const rows = [];
      for (let r = 0; r < MAX_GUESSES; r++) {
        const row = el("div", { class: "eq-row" });
        for (let c = 0; c < LEN; c++) row.appendChild(el("div", { class: "tile" }));
        rows.push(row);
        board.appendChild(row);
      }

      const status = el("p", { class: "center dim", text: `Guess 1 of ${MAX_GUESSES}` });
      const keyEls = {};
      const pad = el("div", { class: "kbd" },
        el("div", { class: "kbd-row" }, "1234567890".split("").map(mkKey)),
        el("div", { class: "kbd-row" }, "+-*/=".split("").map(mkKey)),
        el("div", { class: "kbd-row" },
          el("button", { class: "key wide", text: "⌫", onclick: () => onKey("Backspace") }),
          el("button", { class: "key wide go", text: "enter", onclick: () => onKey("Enter") })
        )
      );
      function mkKey(ch) {
        const b = el("button", { class: "key num", text: ch, onclick: () => onKey(ch) });
        keyEls[ch] = b;
        return b;
      }

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New game", onclick: () => newRound(Math.floor(Math.random() * 1e6) + 1) }),
        el("button", { class: "btn danger", text: "Give up", onclick: () => { if (!over) finish(false); } })
      ));
      mount.appendChild(status);
      mount.appendChild(board);
      mount.appendChild(pad);

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> find the hidden <b>8-character equation</b> in ${MAX_GUESSES} tries.<br><br>
            <b>How to play:</b><br>
            1. Type a complete, <b>mathematically correct</b> equation that fills all
            8 cells — like <b>12+35=47</b> — and press Enter.<br>
            2. Read the colors:
            <span style="color:var(--good);font-weight:700">green</span> = right symbol, right spot ·
            <span style="color:var(--near);font-weight:700">gold</span> = in the equation, wrong spot ·
            gray = not in it at all.<br>
            3. Refine and repeat.<br><br>
            <b>Rules:</b> × and ÷ are computed before + and − (so 1+2*5=11);
            numbers can't start with 0; the right side of = is always a plain number.<br><br>
            <b>Tip:</b> a starter like <b>12+35=47</b> tests seven different symbols at once.`,
        });
      }

      function paintCurrent() {
        const row = rows[guesses.length];
        if (!row) return;
        for (let c = 0; c < LEN; c++) {
          const t = row.children[c];
          t.textContent = current[c] || "";
          t.classList.toggle("filled", !!current[c]);
        }
      }

      function setKeyState(ch, state) {
        const b = keyEls[ch];
        if (!b) return;
        const rank = { bad: 1, near: 2, good: 3 };
        if (b.dataset.state && rank[b.dataset.state] >= rank[state]) return;
        b.dataset.state = state;
        b.classList.remove("good", "near", "bad");
        b.classList.add(state);
      }

      function onKey(key) {
        if (over) return;
        if (key === "Enter") return submit();
        if (key === "Backspace") { current = current.slice(0, -1); paintCurrent(); return; }
        if (CHARS.includes(key) && current.length < LEN) {
          current += key;
          paintCurrent();
        }
      }

      function submit() {
        if (current.length < LEN) return toast("Fill all 8 cells");
        if (!validEquation(current)) {
          board.classList.remove("shake");
          void board.offsetWidth;
          board.classList.add("shake");
          LQ.sound("bad");
          return toast("That equation doesn't compute");
        }
        const row = rows[guesses.length];
        const marks = scoreGuess(current, answer);
        for (let c = 0; c < LEN; c++) {
          row.children[c].classList.add(marks[c], "pop");
          setKeyState(current[c], marks[c]);
        }
        guesses.push(current);
        const won = current === answer;
        current = "";
        status.textContent = `Guess ${Math.min(guesses.length + 1, MAX_GUESSES)} of ${MAX_GUESSES}`;
        if (won) return finish(true);
        if (guesses.length >= MAX_GUESSES) return finish(false);
        LQ.sound("good");
      }

      function finish(won) {
        over = true;
        LQ.sound(won ? "win" : "bad");
        recordResult("eqgrid", { won, score: won ? MAX_GUESSES + 1 - guesses.length : 0 });
        modal({
          title: won ? "🎉 Solved!" : "Out of guesses",
          body: `The equation was <b>${answer}</b>.` +
            (won ? `<br><br>Cracked in ${guesses.length} guess${guesses.length === 1 ? "" : "es"}.` : ""),
          actions: [
            { label: "Play again", primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e6) + 1) },
            { label: "Close" },
          ],
        });
      }

      function physicalKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Enter" || e.key === "Backspace" || CHARS.includes(e.key)) {
          e.preventDefault();
          onKey(e.key);
        }
      }
      document.addEventListener("keydown", physicalKey);
      paintCurrent();
      return () => document.removeEventListener("keydown", physicalKey);
    }

    newRound(0);
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "eqgrid",
    category: "numerical",
    title: "Equation Grid",
    icon: "🧩",
    tagline: "Crack the hidden equation in six guesses. Every guess must compute.",
    render,
  });
})();
