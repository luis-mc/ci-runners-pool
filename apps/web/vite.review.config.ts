import react from '@vitejs/plugin-react';
import { renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// The review build (RES15): review.html -> docs/review/RES15/app/index.html, relative paths, so a plain
// `python3 -m http.server` from that folder serves it. No controller is needed: the data is fake.
const outDir = resolve(import.meta.dirname, '../../docs/review/RES15/app');

/** The built page is named review.html; the folder's front page is index.html. */
function indexName(): Plugin {
  return {
    name: 'review-index-name',
    apply: 'build',
    closeBundle() {
      renameSync(resolve(outDir, 'review.html'), resolve(outDir, 'index.html'));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), indexName()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'review.html') },
  },
});
