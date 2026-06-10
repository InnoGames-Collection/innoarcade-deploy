import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const p = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        hub: p('index.html'),
        templeDash: p('games/temple-dash/index.html'),
      },
    },
  },
});
