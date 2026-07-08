import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const p = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Inline critical shell CSS into game pages so the Play menu paints before JS modules load. */
function injectShellBoot(): Plugin {
  const bootCss = fs.readFileSync(p('src/styles/shell-boot.css'), 'utf8');
  const catalogSrc = fs.readFileSync(p('src/platform/catalog.ts'), 'utf8');

  function accentInlineForGame(gameId: string): string {
    const accentRe = new RegExp(
      `id:\\s*'${gameId.replace(/-/g, '\\-')}'[\\s\\S]{0,500}?accent:\\s*'([^']+)'`,
    );
    const m = catalogSrc.match(accentRe);
    if (!m) return '';
    return `body.game-shell[data-game="${gameId}"]{--game-accent:${m[1]};--shell-accent:${m[1]};}`;
  }

  return {
    name: 'inject-shell-boot',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.filename.replace(/\\/g, '/');
        if (!file.includes('/games/')) return html;
        if (html.includes('id="shell-boot"')) return html;
        const gameId = html.match(/data-game="([^"]+)"/)?.[1] ?? '';
        const themeInline = gameId ? accentInlineForGame(gameId) : '';
        const css = themeInline ? `${bootCss}\n${themeInline}` : bootCss;
        return html.replace('</head>', `<style id="shell-boot">${css}</style></head>`);
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
        waterSort: p('games/water-sort/index.html'),
        parkingJam: p('games/parking-jam/index.html'),
        laserPuzzle: p('games/laser-puzzle/index.html'),
        pianoTiles: p('games/piano-tiles/index.html'),
        stackTower: p('games/stack-tower/index.html'),
        crossyRoad: p('games/crossy-road/index.html'),
        blockBlast: p('games/block-blast/index.html'),
        tileConnect: p('games/tile-connect/index.html'),
        hexaBlock: p('games/hexa-block/index.html'),
        knifeHit: p('games/knife-hit/index.html'),
        helixJump: p('games/helix-jump/index.html'),
        hillClimb: p('games/hill-climb/index.html'),
        towerDefense: p('games/tower-defense/index.html'),
        drawBridge: p('games/draw-bridge/index.html'),
        ballSort: p('games/ball-sort/index.html'),
        jewelMatch: p('games/jewel-match/index.html'),
        reflexTap: p('games/reflex-tap/index.html'),
        doodleJump: p('games/doodle-jump/index.html'),
        zigzag: p('games/zigzag/index.html'),
        colorSwitch: p('games/color-switch/index.html'),
        ropeRescue: p('games/rope-rescue/index.html'),
        pipeConnect: p('games/pipe-connect/index.html'),
        ballMaze: p('games/ball-maze/index.html'),
        arrowShot: p('games/arrow-shot/index.html'),
        slidePuzzle: p('games/slide-puzzle/index.html'),
        raceCar: p('games/race-car/index.html'),
      },
    },
  },
});
