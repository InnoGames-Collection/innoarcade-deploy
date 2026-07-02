import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const p = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Inline critical shell CSS into game pages so the Play menu paints before JS modules load. */
function injectShellBoot(): Plugin {
  const bootCss = fs.readFileSync(p('src/styles/shell-boot.css'), 'utf8');
  return {
    name: 'inject-shell-boot',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.filename.replace(/\\/g, '/');
        if (!file.includes('/games/')) return html;
        if (html.includes('id="shell-boot"')) return html;
        return html.replace('</head>', `<style id="shell-boot">${bootCss}</style></head>`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [injectShellBoot()],
  build: {
    rollupOptions: {
      input: {
        hub: p('index.html'),
        admin: p('admin/index.html'),
        checkout: p('checkout/index.html'),
        orbitBlast: p('games/orbit-blast/index.html'),
        merge2048: p('games/merge-2048/index.html'),
        templeDash: p('games/temple-dash/index.html'),
        metroRush: p('games/metro-rush/index.html'),
        candyCrunch: p('games/candy-crunch/index.html'),
        brickBlitz: p('games/brick-blitz/index.html'),
        fruitSlice: p('games/fruit-slice/index.html'),
        skyHopper: p('games/sky-hopper/index.html'),
        bubblePop: p('games/bubble-pop/index.html'),
        memoryMatch: p('games/memory-match/index.html'),
        tapGame: p('games/tap-game/index.html'),
        luckyBox: p('games/lucky-box/index.html'),
        spinWheel: p('games/spin-wheel/index.html'),
        luckyslot: p('games/luckyslot/index.html'),
        popblast: p('games/popblast/index.html'),
        ethiopianQuiz: p('games/ethiopian-quiz/index.html'),
        // LexiQuest brain & word games — now native GoPlay games.
        vocab: p('games/vocab/index.html'),
        spell: p('games/spell/index.html'),
        logic: p('games/logic/index.html'),
        sequence: p('games/sequence/index.html'),
        rhyme: p('games/rhyme/index.html'),
        sudoku: p('games/sudoku/index.html'),
        target24: p('games/target24/index.html'),
        crosssum: p('games/crosssum/index.html'),
      },
    },
  },
});
