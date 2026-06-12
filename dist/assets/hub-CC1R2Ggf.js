import{g as $,s as w,a as C,t as s}from"./index-DfXpOpcC.js";import{f as g,t as b,l as M,p as q,a as H,C as G,c as I}from"./tournaments-DouD2fSn.js";const r=n=>document.querySelector(n),c=()=>$(),d=n=>c()==="am"?n.nameAm:n.nameEn,v=n=>c()==="am"?n.genreAm:n.genreEn,y=n=>c()==="am"?n.titleAm:n.titleEn;function o(n){return n.replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a])}function l(n){return`background:linear-gradient(145deg, ${n.thumb[0]}, ${n.thumb[1]});`}function j(){const n=r("#featured"),a=g(),e=a?b(a):void 0;if(!a||!e){n.innerHTML="";return}const t=M(a.id,3),m=q(a.id);n.innerHTML=`
    <article class="featured-card" style="${l(e)}">
      <div class="fc-info">
        <span class="fc-badge">🏆 ${o(y(a))}</span>
        <h3 class="fc-title">${o(d(e))}</h3>
        <p class="fc-genre">${o(v(e))}</p>
        <div class="fc-meta">
          <div class="fc-countdown" id="fcCountdown"></div>
          <div class="fc-prize">${s("hub.prize")}: <strong>${a.prizeCoins.toLocaleString()}</strong> ${s("hub.coins")} 🪙</div>
        </div>
        <a class="btn primary fc-cta" href="${e.route}">${s("hub.enterNow")}</a>
      </div>
      <div class="fc-board">
        <div class="fc-board-head">${s("hub.leaderboard")}</div>
        <ol class="leader-list">
          ${t.map(i=>`
            <li class="leader-row${i.isPlayer?" me":""}">
              <span class="lr-rank">${i.rank}</span>
              <span class="lr-name">${o(i.name)}</span>
              <span class="lr-score">${i.score.toLocaleString()}</span>
            </li>`).join("")}
        </ol>
        <div class="fc-yourrank">
          ${m?`${s("hub.yourRank")}: <strong>#${m.rank}</strong>`:`<span class="muted-small">${s("hub.unranked")}</span>`}
        </div>
      </div>
      <div class="fc-glyph">${e.icon}</div>
    </article>`}function z(){const n=r("#tournamentList"),a=H();n.innerHTML=a.map(e=>{const t=b(e);return t?`
      <article class="tour-card">
        <div class="tc-thumb" style="${l(t)}"><span>${t.icon}</span></div>
        <div class="tc-body">
          <span class="live-dot">● ${s("hub.live")}</span>
          <h4>${o(y(e))}</h4>
          <p class="tc-game">${o(d(t))}</p>
          <div class="tc-count" data-ends="${e.endsAt}"></div>
        </div>
        <a class="btn primary tc-cta" href="${t.route}">${s("hub.enterNow")}</a>
      </article>`:""}).join("")}const B={Arcade:"አርኬድ",Puzzle:"እንቆቅልሽ",Runner:"ሩጫ",Skill:"ክህሎት",Casual:"ቀላል"};function R(n){return n.genreEn.split("·")[0].trim()}function N(n){return c()==="am"?B[n]??n:n}function P(n){return`
    <a class="game-card" href="${n.route}">
      <div class="gc-thumb" style="${l(n)}">
        <span class="gc-glyph">${n.icon}</span>
        ${n.mode==="tournament"?`<span class="gc-tag">🏆 ${s("hub.tournament")}</span>`:""}
      </div>
      <div class="gc-body">
        <h4>${o(d(n))}</h4>
        <p>${o(v(n))}</p>
      </div>
    </a>`}function F(){const n=r("#gameGrid"),a=new Map;for(const e of G){const t=R(e);a.has(t)||a.set(t,[]),a.get(t).push(e)}n.innerHTML=[...a.entries()].map(([e,t])=>`
    <div class="cat-block">
      <div class="cat-head"><h3>${o(N(e))}</h3></div>
      <div class="cat-grid">${t.map(P).join("")}</div>
    </div>`).join("")}const K=[{id:"spell",nameEn:"Spell It",nameAm:"ፊደል ቃላት",icon:"🔤",thumb:["#6a4cff","#34238f"]},{id:"vocab",nameEn:"Vocabulary",nameAm:"መዝገበ ቃላት",icon:"📖",thumb:["#2aa9d6","#13627e"]},{id:"rhyme",nameEn:"Rhyme Time",nameAm:"ግጥም",icon:"🎵",thumb:["#e25aa0","#8e2c63"]},{id:"sudoku",nameEn:"Sudoku",nameAm:"ሱዶኩ",icon:"🔢",thumb:["#34b38a","#176049"]},{id:"target24",nameEn:"Target 24",nameAm:"ኢላማ 24",icon:"🎯",thumb:["#f0a832","#9c6310"]},{id:"crosssum",nameEn:"Cross Sum",nameAm:"ድምር",icon:"➕",thumb:["#5b8cff","#27468f"]},{id:"logic",nameEn:"Logic Grid",nameAm:"ሎጂክ",icon:"🧩",thumb:["#ff7a59","#a83b22"]},{id:"sequence",nameEn:"Sequence",nameAm:"ቅደም ተከተል",icon:"🔗",thumb:["#7a6cff","#3d2f9e"]}];function O(){const n=r("#brainGrid");n.innerHTML=K.map(a=>`
    <a class="game-card" href="../lexiquest/#/g/${a.id}">
      <div class="gc-thumb" style="background:linear-gradient(145deg, ${a.thumb[0]}, ${a.thumb[1]});">
        <span class="gc-glyph">${a.icon}</span>
      </div>
      <div class="gc-body"><h4>${o(c()==="am"?a.nameAm:a.nameEn)}</h4></div>
    </a>`).join("")}const Q=()=>c()==="am"?"ቀ":"d",u=()=>c()==="am"?"ሰ":"h",f=()=>c()==="am"?"ደ":"m",U=()=>c()==="am"?"ሰ":"s";function h(n){const a=I(n);return a.done?"—":a.days>0?`${a.days}${Q()} ${a.hours}${u()} ${a.minutes}${f()}`:`${a.hours}${u()} ${a.minutes}${f()} ${a.seconds}${U()}`}function A(){const n=g(),a=document.querySelector("#fcCountdown");a&&n&&(a.innerHTML=`<span class="cd-label">${s("hub.endsIn")}</span> <span class="cd-val">${h(n.endsAt)}</span>`),document.querySelectorAll(".tc-count").forEach(e=>{const t=Number(e.dataset.ends);e.innerHTML=`<span class="cd-label">${s("hub.endsIn")}</span> <strong>${h(t)}</strong>`})}function E(){j(),z(),F(),O(),C(),A()}const L=r("#langEn"),S=r("#langAm");function T(){L.classList.toggle("active",c()==="en"),S.classList.toggle("active",c()==="am")}function k(n){w(n),T(),E()}L.addEventListener("click",()=>k("en"));S.addEventListener("click",()=>k("am"));const p=["dashboard","tournaments","games","brain"];window.addEventListener("scroll",()=>{let n=p[0];for(const a of p){const e=document.getElementById(a);e&&e.getBoundingClientRect().top<=120&&(n=a)}document.querySelectorAll(".nav-link").forEach(a=>{a.classList.toggle("active",a.getAttribute("href")===`#${n}`)})},{passive:!0});document.documentElement.lang=$();T();E();setInterval(A,1e3);
