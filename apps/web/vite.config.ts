import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server proxies the controller so the app can call /healthz and /api. The controller
// serves HTTPS only (R5.1) with a certificate of its own CA, so the proxy does not verify it
// (development only), and it sends the controller's own Origin because the controller refuses a
// change from another one (R6.2).
const controller = 'https://127.0.0.1:8460';
const toController = {
  target: controller,
  secure: false,
  configure: (proxy: {
    on: (
      e: string,
      f: (req: { setHeader: (k: string, v: string) => void }) => void,
    ) => void;
  }) => {
    proxy.on('proxyReq', (req) => req.setHeader('Origin', controller));
  },
};

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/healthz': toController,
      '/api': toController,
    },
  },
});
