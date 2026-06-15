/* Digit Sprint — 60 seconds of rapid-fire mental arithmetic. */
(function () {
  "use strict";
  const { el, toast, modal, keypad, recordResult, randInt, statsRow, getStats } = LQ;

  const SECONDS = 60;

  function makeQuestion(level) {
    // ranges grow with level
    const lo = 2 + level * 2, hi = 10 + level * 6;
    switch (randInt(0, Math.min(3, 1 + Math.floor(level / 2)))) {
      case 0: { const a = randInt(lo, hi), b = randInt(lo, hi); return { q: `${a} + ${b}`, a: a + b }; }
      case 1: { const a = randInt(lo, hi), b = randInt(2, a); return { q: `${a} − ${b}`, a: a - b }; }
      case 2: { const a = randInt(2, 5 + level), b = randInt(3, 9 + level); return { q: `${a} × ${b}`, a: a * b }; }
      default: { const b = randInt(2, 9), c = randInt(3, 9 + level); return { q: `${b * c} ÷ ${b}`, a: c }; }
    }
  }

  function render(mount) {
    let cleanup = null;

    function newRound() {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound();
    }

    function startRound() {
      let score = 0;
      let streak = 0;
      let typed = "";
      let item = null;
      let secondsLeft = SECONDS;
      let started = false;
      let over = false;

      const sub = el("p", { class: "sub center" });
      const q = el("div", { class: "big-q" });
      const a = el("div", { class: "big-a" });
      const fb = el("div", { class: "quiz-feedback center" });
      const bar = el("div", { class: "timebar" }, el("div", { class: "fill" }));
      const scoreEl = el("div");
      const card = el("div", { class: "quiz-q" }, sub, bar, q, a, fb);
      const pad = keypad(onKey);
      const startBtn = el("button", { class: "btn primary", text: "Start sprint", onclick: begin });

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        startBtn
      ));
      mount.appendChild(scoreEl);
      mount.appendChild(el("div", { class: "quiz-wrap" }, card));
      mount.appendChild(pad);

      sub.textContent = "Press Start — 60 seconds on the clock";
      q.textContent = "? + ?";
      paintScore();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> answer as many arithmetic questions as you can in
            <b>${SECONDS} seconds</b>.<br><br>
            <b>How to play:</b><br>
            1. Press <b>Start sprint</b> — the clock begins immediately.<br>
            2. Type the answer on the keypad. It <b>submits itself</b> the moment you've
            typed the right number of digits — no Enter needed.<br>
            3. Wrong answers cost no points, only precious seconds.<br><br>
            <b>Scoring:</b> +1 per correct answer · every 5-in-a-row streak adds a
            <b>+3 bonus</b> · questions get harder as your score climbs.<br><br>
            <b>Tip:</b> for two-digit additions, add the tens first, then the ones.`,
        });
      }

      function paintScore() {
        scoreEl.innerHTML = "";
        scoreEl.appendChild(statsRow([
          [score, "score"], [streak, "streak"], [getStats("sprint").best, "best"],
        ]));
      }

      function begin() {
        if (started) return;
        started = true;
        startBtn.disabled = true;
        nextQuestion();
        const t0 = Date.now();
        const timer = setInterval(() => {
          secondsLeft = SECONDS - Math.floor((Date.now() - t0) / 1000);
          bar.firstChild.style.width = Math.max(0, (secondsLeft / SECONDS) * 100) + "%";
          sub.textContent = `${Math.max(0, secondsLeft)}s left`;
          if (secondsLeft <= 0) { clearInterval(timer); finish(); }
        }, 250);
        cleanupTimers.push(() => clearInterval(timer));
      }

      function nextQuestion() {
        const level = Math.floor(score / 4);
        item = makeQuestion(level);
        typed = "";
        q.textContent = item.q + " = ?";
        a.textContent = "";
      }

      function onKey(key) {
        if (!started || over) return;
        if (key === "Enter") return submit();
        if (key === "Backspace") typed = typed.slice(0, -1);
        else if (/^\d$/.test(key) && typed.length < 6) typed += key;
        a.textContent = typed;
        // auto-submit when the typed length matches the answer length
        if (typed.length && typed.length === String(item.a).length) submit();
      }

      function submit() {
        if (typed === "") return;
        if (Number(typed) === item.a) {
          score++;
          streak++;
          if (streak % 5 === 0) { score += 3; toast("🔥 Streak bonus +3"); }
          LQ.sound("good");
          fb.textContent = "✓";
          fb.className = "quiz-feedback good center";
        } else {
          streak = 0;
          LQ.sound("bad");
          fb.textContent = `✗ ${item.q} = ${item.a}`;
          fb.className = "quiz-feedback bad center";
        }
        paintScore();
        nextQuestion();
      }

      function finish() {
        if (over) return;
        over = true;
        const prevBest = getStats("sprint").best;
        LQ.sound(score > prevBest ? "win" : "good");
        recordResult("sprint", { won: score >= 15, score });
        modal({
          title: score > prevBest ? "🏅 New personal best!" : "⏱️ Time's up!",
          body: `You scored <b>${score}</b> point${score === 1 ? "" : "s"}.` +
            (score > prevBest ? `<br>Previous best: ${prevBest}.` : `<br>Personal best: ${Math.max(prevBest, score)}.`),
          actions: [
            { label: "Sprint again", primary: true, onClick: newRound },
            { label: "Close" },
          ],
        });
        paintScore();
      }

      const cleanupTimers = [];
      function physicalKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Enter" || e.key === "Backspace" || /^\d$/.test(e.key)) {
          e.preventDefault();
          onKey(e.key);
        }
      }
      document.addEventListener("keydown", physicalKey);
      return () => {
        document.removeEventListener("keydown", physicalKey);
        cleanupTimers.forEach((f) => f());
      };
    }

    newRound();
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "sprint",
    category: "numerical",
    title: "Digit Sprint",
    icon: "⚡",
    tagline: "Sixty seconds of rapid-fire mental math. How high can you score?",
    render,
  });
})();
