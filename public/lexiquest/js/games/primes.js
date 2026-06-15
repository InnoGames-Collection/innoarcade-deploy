/* Prime Hunter — tap every prime in the grid before your strikes run out. */
(function () {
  "use strict";
  const { el, modal, recordResult, randInt, shuffled, statsRow } = LQ;

  const ROUNDS = 5;
  const STRIKES = 3;

  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }

  function makeRound(roundIdx) {
    const hi = 30 + roundIdx * 25;
    const primes = new Set();
    const composites = new Set();
    while (primes.size < 4 + Math.min(roundIdx, 2)) {
      const n = randInt(2, hi);
      if (isPrime(n)) primes.add(n);
    }
    while (composites.size < 12 - primes.size) {
      const n = randInt(4, hi);
      // favor tricky composites: odd non-primes like 91, 87, 51...
      if (!isPrime(n) && (n % 2 === 1 || composites.size < 3)) composites.add(n);
    }
    return { nums: shuffled([...primes, ...composites]), primeCount: primes.size };
  }

  function render(mount) {
    let cleanup = null;

    function newRound() {
      if (cleanup) cleanup();
      mount.innerHTML = "";
      cleanup = startRound();
    }

    function startRound() {
      let round = 0;
      let score = 0;
      let strikes = 0;
      let over = false;

      const sub = el("p", { class: "sub center" });
      const scoreEl = el("div");
      const fb = el("div", { class: "quiz-feedback center" });
      const gridEl = el("div", { class: "trek-grid", style: "--cell: 72px;" });

      mount.appendChild(el("div", { class: "game-toolbar" },
        el("button", { class: "btn", text: "How to play", onclick: showHelp }),
        el("button", { class: "btn", text: "New hunt", onclick: newRound })
      ));
      mount.appendChild(scoreEl);
      mount.appendChild(sub);
      mount.appendChild(gridEl);
      mount.appendChild(fb);
      nextRound();

      function showHelp() {
        modal({
          title: "How to play",
          body: `<b>Goal:</b> clear ${ROUNDS} rounds by tapping every <b>prime number</b>
            in the grid — and nothing else.<br><br>
            <b>How to play:</b><br>
            1. The round tells you how many primes are hiding. Tap them all to advance.<br>
            2. Tapping a composite costs a <b>strike</b> and shows you its factors —
            ${STRIKES} strikes ends the hunt.<br><br>
            <b>Reminders:</b> a prime divides only by 1 and itself; 2 is the only even
            prime; 1 is not prime.<br><br>
            <b>Tips:</b> digits summing to a multiple of 3 = divisible by 3 (87 = 3×29);
            ends in 5 = divisible by 5; and the classic trap <b>91 = 7×13</b>.`,
        });
      }

      function paintScore() {
        scoreEl.innerHTML = "";
        scoreEl.appendChild(statsRow([
          [score, "primes found"], [STRIKES - strikes, "strikes left"], [round + 1, "round"],
        ]));
      }

      function nextRound() {
        if (over) return;
        if (round >= ROUNDS) return finish(true);
        const { nums, primeCount } = makeRound(round);
        let foundHere = 0;
        sub.textContent = `Round ${round + 1} of ${ROUNDS} — find ${primeCount} primes`;
        fb.textContent = "";
        gridEl.innerHTML = "";
        paintScore();
        nums.forEach((n) => {
          const cell = el("div", {
            class: "trek-cell", text: String(n), role: "button", tabindex: "0",
            onclick: () => tap(),
            onkeydown: (e) => { if (e.key === "Enter") tap(); },
          });
          function tap() {
            if (over || cell.classList.contains("good") || cell.classList.contains("bad")) return;
            if (isPrime(n)) {
              cell.classList.add("good");
              score++;
              foundHere++;
              LQ.sound("good");
              paintScore();
              if (foundHere === primeCount) {
                round++;
                fb.textContent = "Round clear!";
                fb.className = "quiz-feedback good center";
                setTimeout(nextRound, 900);
              }
            } else {
              cell.classList.add("bad");
              strikes++;
              LQ.sound("bad");
              const fs = factorize(n);
              fb.textContent = `${n} = ${fs} — that's a strike.`;
              fb.className = "quiz-feedback bad center";
              paintScore();
              if (strikes >= STRIKES) finish(false);
            }
          }
          gridEl.appendChild(cell);
        });
      }

      function factorize(n) {
        for (let i = 2; i * i <= n; i++) if (n % i === 0) return `${i} × ${n / i}`;
        return String(n);
      }

      function finish(won) {
        over = true;
        LQ.sound(won ? "win" : "bad");
        recordResult("primes", { won, score });
        modal({
          title: won ? "🏹 Hunt complete!" : "💥 Three strikes!",
          body: `You bagged <b>${score}</b> primes across ${Math.min(round + 1, ROUNDS)} round${round ? "s" : ""}.`,
          actions: [
            { label: "Hunt again", primary: true, onClick: newRound },
            { label: "Close" },
          ],
        });
      }
    }

    newRound();
    return () => { if (cleanup) cleanup(); };
  }

  LQ.register({
    id: "primes",
    category: "math",
    title: "Prime Hunter",
    icon: "🏹",
    tagline: "Tap the primes, dodge the impostors. 91 is not your friend.",
    render,
  });
})();
