import{g,s as w,a as C,t as a}from"./index-CQyVNW2z.js";import{f as h,t as v,l as H,p as M,a as q,C as G,c as I}from"./tournaments-DouD2fSn.js";const r=s=>document.querySelector(s),c=()=>g(),l=s=>c()==="am"?s.nameAm:s.nameEn,b=s=>c()==="am"?s.genreAm:s.genreEn,y=s=>c()==="am"?s.titleAm:s.titleEn;function o(s){return s.replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n])}function d(s){return`background:linear-gradient(145deg, ${s.thumb[0]}, ${s.thumb[1]});`}function j(){const s=r("#featured"),n=h(),t=n?v(n):void 0;if(!n||!t){s.innerHTML="";return}const e=H(n.id,3),u=M(n.id);s.innerHTML=`
    <article class="featured-card" style="${d(t)}">
      <div class="fc-info">
        <span class="fc-badge">🏆 ${o(y(n))}</span>
        <h3 class="fc-title">${o(l(t))}</h3>
        <p class="fc-genre">${o(b(t))}</p>
        <div class="fc-meta">
          <div class="fc-countdown" id="fcCountdown"></div>
          <div class="fc-prize">${a("hub.prize")}: <strong>${n.prizeCoins.toLocaleString()}</strong> ${a("hub.coins")} 🪙</div>
        </div>
        <a class="btn primary fc-cta" href="${t.route}">${a("hub.enterNow")}</a>
      </div>
      <div class="fc-board">
        <div class="fc-board-head">${a("hub.leaderboard")}</div>
        <ol class="leader-list">
          ${e.map(i=>`
            <li class="leader-row${i.isPlayer?" me":""}">
              <span class="lr-rank">${i.rank}</span>
              <span class="lr-name">${o(i.name)}</span>
              <span class="lr-score">${i.score.toLocaleString()}</span>
            </li>`).join("")}
        </ol>
        <div class="fc-yourrank">
          ${u?`${a("hub.yourRank")}: <strong>#${u.rank}</strong>`:`<span class="muted-small">${a("hub.unranked")}</span>`}
        </div>
      </div>
      <div class="fc-glyph">${t.icon}</div>
    </article>`}function z(){const s=r("#tournamentList"),n=q();s.innerHTML=n.map(t=>{const e=v(t);return e?`
      <article class="tour-card">
        <div class="tc-thumb" style="${d(e)}"><span>${e.icon}</span></div>
        <div class="tc-body">
          <span class="live-dot">● ${a("hub.live")}</span>
          <h4>${o(y(t))}</h4>
          <p class="tc-game">${o(l(e))}</p>
          <div class="tc-count" data-ends="${t.endsAt}"></div>
        </div>
        <a class="btn primary tc-cta" href="${e.route}">${a("hub.enterNow")}</a>
      </article>`:""}).join("")}function B(){const s=r("#gameGrid");s.innerHTML=G.map(n=>`
    <a class="game-card" href="${n.route}">
      <div class="gc-thumb" style="${d(n)}">
        <span class="gc-glyph">${n.icon}</span>
        ${n.mode==="tournament"?`<span class="gc-tag">🏆 ${a("hub.tournament")}</span>`:""}
      </div>
      <div class="gc-body">
        <h4>${o(l(n))}</h4>
        <p>${o(b(n))}</p>
      </div>
    </a>`).join("")}const N=()=>c()==="am"?"ቀ":"d",m=()=>c()==="am"?"ሰ":"h",$=()=>c()==="am"?"ደ":"m",R=()=>c()==="am"?"ሰ":"s";function p(s){const n=I(s);return n.done?"—":n.days>0?`${n.days}${N()} ${n.hours}${m()} ${n.minutes}${$()}`:`${n.hours}${m()} ${n.minutes}${$()} ${n.seconds}${R()}`}function L(){const s=h(),n=document.querySelector("#fcCountdown");n&&s&&(n.innerHTML=`<span class="cd-label">${a("hub.endsIn")}</span> <span class="cd-val">${p(s.endsAt)}</span>`),document.querySelectorAll(".tc-count").forEach(t=>{const e=Number(t.dataset.ends);t.innerHTML=`<span class="cd-label">${a("hub.endsIn")}</span> <strong>${p(e)}</strong>`})}function A(){j(),z(),B(),C(),L()}const k=r("#langEn"),E=r("#langAm");function S(){k.classList.toggle("active",c()==="en"),E.classList.toggle("active",c()==="am")}function T(s){w(s),S(),A()}k.addEventListener("click",()=>T("en"));E.addEventListener("click",()=>T("am"));const f=["dashboard","tournaments","games"];window.addEventListener("scroll",()=>{let s=f[0];for(const n of f){const t=document.getElementById(n);t&&t.getBoundingClientRect().top<=120&&(s=n)}document.querySelectorAll(".nav-link").forEach(n=>{n.classList.toggle("active",n.getAttribute("href")===`#${s}`)})},{passive:!0});document.documentElement.lang=g();S();A();setInterval(L,1e3);
