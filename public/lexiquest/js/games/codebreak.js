/* Code Breaker — crack the four-color secret code (Mastermind-style). */
(function () {
  "use strict";
  const { el, toast, modal, recordResult, mulberry32, dayNumber, randInt } = LQ;

  const COLORS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];
  const CODE_LEN = 4;
  const MAX_ROWS = 10;

  function feedback(guess, secret) {
    let hit = 0, near = 0;
    const sLeft = [], gLeft = [];
    for (let i = 0; i < CODE_LEN; i++) {
      if (guess[i] === secret[i]) hit++;
      else { sLeft.push(secret[i]); gLeft.push(guess[i]); }
    }
    for (const g of gLeft) {
      const idx = sLeft.indexOf(g);
      if (idx >= 0) { near++; sLeft.splice(idx, 1); }
    }
    return { hit, near };
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
      const secret = Array.from({ length: CODE_LEN }, () => COLORS[Math.floor(rnd() * COLORS.length)]);
      let current = [];
      let rowIdx = 0;
      let over = false;

      const rowsWrap = el("div");
      const rows = [];
      for (let r = 0; r < MAX_ROWS; r++) {
        const pegs = Array.from({ length: CODE_LEN }, () => el("div", { class: "cb-peg" }));
        const dots = Array.from({ length: CODE_LEN }, () => el("div", { class: "cb-dot" }));
        const row = el("div", { class: "cb-row" }, pegs, el("div", { class: "cb-fb" }, dots));
        rows.push({ pegs, dots });
        rowsWrap.appendChild(row);
      }

      const palette = el("div", { class: "cb-palette" },
        COLORS.map((c) => el("button", {
          class: "cb-peg", text: c, "aria-label": "color " + c,
          onclick: () => pickColor(c),
        })),
        el("button", { class: "btn", text: "⌫", "aria-label": "Remove last", onclick: removeLast }),
        el("button", { class: "btn primary", text: "Check", onclick: submit })
      );

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New code", onclick: () => newRound(Math.floor(Math.random() * 1e9)) }),
        el("button", { class: "btn danger", text: "Give up", onclick: () => { if (!over) finish(false); } })
      ));
      const status = el("p", { class: "center dim", text: `Attempt 1 of ${MAX_ROWS}` });
      mount.appendChild(status);
      mount.appendChild(rowsWrap);
      mount.appendChild(palette);

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> crack the secret <b>4-color code</b> in ${MAX_ROWS} tries.
            Colors <b>may repeat</b>.<br><br>
            <b>How to play:</b><br>
            1. Tap colors from the palette to fill the four pegs, then tap <b>Check</b>.<br>
            2. Read the dots next to your row:
            <span style="color:var(--good);font-weight:700">green dot</span> = a peg with
            the right color in the right place ·
            <span style="color:var(--near);font-weight:700">gold dot</span> = right color,
            wrong place.<br>
            3. Important: the dots <b>don't say which peg</b> they refer to — that's the puzzle.<br><br>
            <b>Tip:</b> early guesses with repeated colors (🔴🔴🔵🔵) quickly reveal
            <i>how many</i> of each color the code contains.`,
        });
      }

      function paintCurrent() {
        const { pegs } = rows[rowIdx];
        for (let i = 0; i < CODE_LEN; i++) pegs[i].textContent = current[i] || "";
      }

      function pickColor(c) {
        if (over || current.length >= CODE_LEN) return;
        current.push(c);
        LQ.sound("click");
        paintCurrent();
      }

      function removeLast() {
        if (over) return;
        current.pop();
        paintCurrent();
      }

      function submit() {
        if (over) return;
        if (current.length < CODE_LEN) return toast("Place all four pegs");
        const { hit, near } = feedback(current, secret);
        const { dots } = rows[rowIdx];
        for (let i = 0; i < CODE_LEN; i++) {
          if (i < hit) dots[i].classList.add("hit");
          else if (i < hit + near) dots[i].classList.add("near");
        }
        if (hit === CODE_LEN) return finish(true);
        rowIdx++;
        current = [];
        status.textContent = `Attempt ${rowIdx + 1} of ${MAX_ROWS} — ${hit} exact, ${near} misplaced`;
        LQ.sound(hit + near > 0 ? "good" : "bad");
        if (rowIdx >= MAX_ROWS) return finish(false);
      }

      function finish(won) {
        over = true;
        LQ.sound(won ? "win" : "bad");
        recordResult("codebreak", { won, score: won ? MAX_ROWS - rowIdx : 0 });
        modal({
          title: won ? "🔓 Code cracked!" : "🔒 Locked out",
          body: `The code was ${secret.join(" ")}.` +
            (won ? `<br><br>Cracked in ${rowIdx + 1} attempt${rowIdx ? "s" : ""}.` : ""),
          actions: [
            { label: "New code", primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e9)) },
            { label: "Close" },
          ],
        });
      }

      return () => {};
    }

    newRound(dayNumber() * 4099 + randInt(0, 9));
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "codebreak",
    category: "analytical",
    title: "Code Breaker",
    icon: "🔐",
    tagline: "Deduce the secret four-color code from exact and misplaced clues.",
    render,
  });
})();
