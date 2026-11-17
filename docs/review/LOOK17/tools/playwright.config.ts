// Review-only config (LOOK17): shoots the real console from the Vite dev server with the mocked API of the e2e specs.
// Run from the repository root:  VARIANT=today pnpm exec playwright test -c docs/review/LOOK17/tools/playwright.config.ts
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: resolve(import.meta.dirname),
  testMatch: 'shoot.spec.ts',
  reporter: 'line',
  outputDir: resolve('test-results', 'look17'),
  workers: 1,
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  webServer: {
    cwd: resolve('apps/web'),
    command: './node_modules/.bin/vite --port 5199 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
