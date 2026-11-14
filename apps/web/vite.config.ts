import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server proxies the controller so the app can call /healthz and /api.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/healthz': 'http://127.0.0.1:8080',
      '/api': 'http://127.0.0.1:8080',
    },
  },
});
