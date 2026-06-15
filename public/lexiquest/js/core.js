/* LexiQuest core: routing, registry, storage, shared UI, sound, PWA. */
(function () {
  "use strict";

  const games = [];
  const byId = {};

  const CATEGORIES = [
    { id: "word", icon: "🔤", title: "Word Games", blurb: "Letters, spelling, and vocabulary." },
    { id: "numerical", icon: "🔢", title: "Numerical Games", blurb: "Digits, sequences, and quick arithmetic." },
    { id: "math", icon: "🧮", title: "Mathematical Games", blurb: "Sudoku, sums, fractions, and primes." },
    { id: "analytical", icon: "🧠", title: "Analytical Games", blurb: "Logic, memory, and pattern reasoning." },
  ];

  // ---------- utilities ----------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dayNumber() {
    return Math.floor(Date.now() / 86400000);
  }

  function shuffled(arr, rnd) {
    const a = arr.slice();
    const r = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, rnd) {
    return arr[Math.floor((rnd || Math.random)() * arr.length)];
  }

  function randInt(lo, hi, rnd) {
    return lo + Math.floor((rnd || Math.random)() * (hi - lo + 1));
  }

  // ---------- storage / stats / xp ----------
  const KEY = "lexiquest.v1";
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function getStats(gameId) {
    const s = loadStore();
    return s.stats && s.stats[gameId] || { played: 0, won: 0, best: 0, streak: 0 };
  }
  function getXP() {
    const s = loadStore();
    return s.xp || 0;
  }
  function levelFor(xp) {
    return 1 + Math.floor(Math.sqrt(xp / 25));
  }
  function recordResult(gameId, { won, score }) {
    const s = loadStore();
    s.stats = s.stats || {};
    const st = s.stats[gameId] || { played: 0, won: 0, best: 0, streak: 0 };
    st.played++;
    if (won) { st.won++; st.streak++; } else { st.streak = 0; }
    if (typeof score === "number" && score > st.best) st.best = score;
    s.stats[gameId] = st;
    const gained = (won ? 20 : 5) + Math.min(Math.max(score || 0, 0), 30);
    const before = levelFor(s.xp || 0);
    s.xp = (s.xp || 0) + gained;
    saveStore(s);
    if (levelFor(s.xp) > before) {
      sound("win");
      toast(`⬆️ Level up! You are now level ${levelFor(s.xp)}`, 2600);
    }
    paintXP();
  }
  function paintXP() {
    const chip = document.getElementById("xpChip");
    if (!chip) return;
    const xp = getXP();
    chip.textContent = `Lv ${levelFor(xp)} · ${xp} XP`;
  }

  // ---------- sound (tiny WebAudio synth, no assets) ----------
  let audioCtx = null;
  function isMuted() { return !!loadStore().muted; }
  function sound(name) {
    if (isMuted()) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const notes = {
        click: [[700, 0, 0.04]],
        good: [[660, 0, 0.08], [880, 0.08, 0.1]],
        bad: [[240, 0, 0.16]],
        win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.18]],
      }[name];
      if (!notes) return;
      for (const [freq, at, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = name === "bad" ? "sawtooth" : "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + dur + 0.02);
      }
    } catch (e) { /* audio unavailable */ }
  }
  function toggleMute() {
    const s = loadStore();
    s.muted = !s.muted;
    saveStore(s);
    paintMute();
  }
  function paintMute() {
    const b = document.getElementById("soundBtn");
    if (b) {
      b.textContent = isMuted() ? "🔇" : "🔊";
      b.setAttribute("aria-label", isMuted() ? "Unmute sounds" : "Mute sounds");
    }
  }

  // ---------- toast / modal / share ----------
  let toastTimer = null;
  function toast(msg, ms) {
    let t = document.getElementById("toast");
    if (!t) {
      t = el("div", { id: "toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms || 1800);
  }

  function modal({ title, body, actions }) {
    const back = el("div", { class: "modal-back" });
    const close = () => back.remove();
    const actionBtns = (actions || [{ label: "OK", primary: true }]).map((a) =>
      el("button", {
        class: "btn" + (a.primary ? " primary" : ""),
        text: a.label,
        onclick: () => { close(); if (a.onClick) a.onClick(); },
      })
    );
    const m = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
      el("h3", { text: title }),
      el("div", { class: "body" }),
      el("div", { class: "actions" }, actionBtns)
    );
    const bodyEl = m.querySelector(".body");
    if (typeof body === "string") bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.appendChild(m);
    document.body.appendChild(back);
    const first = m.querySelector("button");
    if (first) first.focus();
    return { close };
  }

  async function share(text) {
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { /* user cancelled — fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(text);
      toast("Result copied — paste it anywhere!");
    } catch (e) {
      modal({ title: "Share your result", body: el("pre", { text }) });
    }
  }

  function statsRow(pairs) {
    return el("div", { class: "stats-row" },
      pairs.map(([num, lbl]) =>
        el("div", { class: "stat" },
          el("div", { class: "num", text: String(num) }),
          el("div", { class: "lbl", text: lbl }))
      )
    );
  }

  // ---------- on-screen keyboard (letters) ----------
  const KBD_ROWS = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"]; // + = enter, - = backspace
  function keyboard(onKey) {
    const keyEls = {};
    const wrap = el("div", { class: "kbd", role: "group", "aria-label": "On-screen keyboard" },
      KBD_ROWS.map((row) =>
        el("div", { class: "kbd-row" },
          row.split("").map((ch) => {
            const isEnter = ch === "+", isBack = ch === "-";
            const label = isEnter ? "enter" : isBack ? "⌫" : ch;
            const key = isEnter ? "Enter" : isBack ? "Backspace" : ch;
            const btn = el("button", {
              class: "key" + (isEnter || isBack ? " wide" : ""),
              text: label,
              "aria-label": key,
              onclick: () => onKey(key),
            });
            if (!isEnter && !isBack) keyEls[ch] = btn;
            return btn;
          })
        )
      )
    );
    return {
      element: wrap,
      setState(letter, state) {
        const b = keyEls[letter];
        if (!b) return;
        const rank = { bad: 1, near: 2, good: 3 };
        const cur = b.dataset.state;
        if (cur && rank[cur] >= rank[state]) return;
        b.dataset.state = state;
        b.classList.remove("good", "near", "bad");
        b.classList.add(state);
      },
      reset() {
        Object.values(keyEls).forEach((b) => {
          delete b.dataset.state;
          b.classList.remove("good", "near", "bad");
        });
      },
    };
  }

  // ---------- numeric keypad (digits + custom extras) ----------
  function keypad(onKey, extras) {
    const rows = [["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]];
    const last = ["0"].concat(extras || []);
    const wrap = el("div", { class: "kbd keypad", role: "group", "aria-label": "Number pad" },
      rows.concat([last]).map((row) =>
        el("div", { class: "kbd-row" },
          row.map((k) => el("button", { class: "key num", text: k, onclick: () => onKey(k) }))
        )
      ),
      el("div", { class: "kbd-row" },
        el("button", { class: "key wide", text: "⌫", "aria-label": "Backspace", onclick: () => onKey("Backspace") }),
        el("button", { class: "key wide go", text: "enter", "aria-label": "Enter", onclick: () => onKey("Enter") })
      )
    );
    return wrap;
  }

  // ---------- hidden input that summons the phone keyboard ----------
  function typeCatcher(onKey, tapTarget) {
    const inp = el("input", {
      type: "text", class: "type-catcher", autocapitalize: "none",
      autocomplete: "off", autocorrect: "off", spellcheck: "false",
      "aria-hidden": "true", tabindex: "-1", enterkeyhint: "send",
    });
    inp.addEventListener("input", () => {
      const v = inp.value;
      inp.value = "";
      for (const ch of v) if (/^[a-z0-9]$/i.test(ch)) onKey(ch.toLowerCase());
    });
    inp.addEventListener("keydown", (e) => {
      // stop bubbling so document-level handlers don't double-process
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
        onKey(e.key);
      }
    });
    tapTarget.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) inp.focus({ preventScroll: true });
    });
    tapTarget.appendChild(inp);
    return inp;
  }

  // ---------- registry & router ----------
  let activeCleanup = null;

  function register(def) {
    def.category = def.category || "word";
    games.push(def);
    byId[def.id] = def;
  }

  function renderHub(app) {
    const xp = getXP();
    app.appendChild(el("div", { class: "hub-intro" },
      el("h1", { text: "GoPlay Games" }),
      el("p", { text: "Free word, number, math, and logic games by InnoSphere Technologies." }),
      el("div", { class: "hub-badges" },
        el("span", { class: "badge", id: "xpChip", text: `Lv ${levelFor(xp)} · ${xp} XP` }),
        el("span", { class: "badge", text: `${games.length} games` })
      )
    ));
    for (const cat of CATEGORIES) {
      const inCat = games.filter((g) => g.category === cat.id);
      if (!inCat.length) continue;
      app.appendChild(el("div", { class: "cat-head" },
        el("h2", { text: cat.icon + " " + cat.title }),
        el("p", { text: cat.blurb })
      ));
      const grid = el("div", { class: "hub-grid" });
      for (const g of inCat) {
        const st = getStats(g.id);
        const meta = st.played
          ? `Played ${st.played} · Won ${st.won}` + (st.best ? ` · Best ${st.best}` : "")
          : "Not played yet";
        grid.appendChild(el("div", {
          class: "game-card", role: "link", tabindex: "0",
          "aria-label": "Play " + g.title,
          onclick: () => { location.hash = "#/g/" + g.id; },
          onkeydown: (e) => { if (e.key === "Enter") location.hash = "#/g/" + g.id; },
        },
          el("div", { class: "icon", text: g.icon }),
          el("h3", { text: g.title }),
          el("p", { text: g.tagline }),
          el("div", { class: "meta", text: meta }),
          el("button", { class: "play", text: "Play", tabindex: "-1" })
        ));
      }
      app.appendChild(grid);
    }
  }

  function renderGame(app, g) {
    app.appendChild(el("div", { class: "game-head" },
      el("h2", { text: g.icon + "  " + g.title }),
      el("p", { class: "tagline", text: g.tagline })
    ));
    const mount = el("div", { class: "game-mount" });
    app.appendChild(mount);
    activeCleanup = g.render(mount, api) || null;
  }

  function route() {
    if (typeof activeCleanup === "function") { activeCleanup(); }
    activeCleanup = null;
    const app = document.getElementById("app");
    app.innerHTML = "";
    const m = location.hash.match(/^#\/g\/([\w-]+)/);
    const g = m && byId[m[1]];
    const back = document.getElementById("backBtn");
    if (g) { back.style.visibility = "visible"; renderGame(app, g); }
    else {
      // No game selected: this app is embedded in GoPlay — there is no standalone
      // LexiQuest landing. Send the player back to the GoPlay games hub.
      location.href = "../#games";
      return;
    }
    window.scrollTo(0, 0);
  }

  // ---------- theme ----------
  function initTheme() {
    const s = loadStore();
    const pref = s.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = pref;
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = cur;
    const s = loadStore(); s.theme = cur; saveStore(s);
  }

  // ---------- public API ----------
  const api = {
    el, toast, modal, keyboard, keypad, typeCatcher, statsRow, share, sound,
    mulberry32, dayNumber, shuffled, pick, randInt,
    getStats, recordResult, getXP, levelFor,
    register,
  };
  window.LQ = api;

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    paintMute();
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    const soundBtn = document.getElementById("soundBtn");
    if (soundBtn) soundBtn.addEventListener("click", toggleMute);
    // Back and brand return to the GoPlay hub (the games live inside GoPlay now).
    document.getElementById("backBtn").addEventListener("click", () => { location.href = "../#games"; });
    document.querySelector(".brand").addEventListener("click", () => { location.href = "../#games"; });
    window.addEventListener("hashchange", route);
    route();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http") &&
        !location.search.includes("nosw")) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* offline support optional */ });
    }
  });
})();
