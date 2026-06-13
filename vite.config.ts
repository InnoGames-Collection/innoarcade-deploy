import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const p = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        hub: p('index.html'),
        admin: p('admin/index.html'),
        orbitBlast: p('games/orbit-blast/index.html'),
        merge2048: p('games/merge-2048/index.html'),
        templeDash: p('games/temple-dash/index.html'),
        metroRush: p('games/metro-rush/index.html'),
        candyCrunch: p('games/candy-crunch/index.html'),
        dotLink: p('games/dot-link/index.html'),
        brickBlitz: p('games/brick-blitz/index.html'),
        fruitSlice: p('games/fruit-slice/index.html'),
        skyHopper: p('games/sky-hopper/index.html'),
        bubblePop: p('games/bubble-pop/index.html'),
      },
    },
  },
});
