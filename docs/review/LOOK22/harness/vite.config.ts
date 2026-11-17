// LOOK22 review harness. Serves the REAL console (apps/web) with a mocked API. When OPTION is A, B or C the
// import of './PoolSize' in Machines.tsx is redirected to the option file; with no OPTION the app is today's.
// Nothing under apps/web or packages/ui is changed. Run: OPTION=A pnpm exec vite --config <this file> --port 5201
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const web = resolve(repo, 'apps/web');
// The harness dir has no node_modules: the plugin is loaded from apps/web.
const reactPlugin = (await import(pathToFileURL(resolve(web, 'node_modules/@vitejs/plugin-react/dist/index.js')).href)).default as () => unknown;
const option = process.env.OPTION ?? '';

export default {
  root: here,
  plugins: [
    {
      name: 'look22-swap-pool-size',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          option &&
          source === './PoolSize' &&
          importer?.replaceAll('\\', '/').endsWith('screens/machines/Machines.tsx')
        )
          return resolve(here, `options/${option}.tsx`);
        return null;
      },
    },
    reactPlugin(),
  ],
  resolve: {
    alias: [
      { find: '@app', replacement: resolve(web, 'src') },
      { find: /^@crsp\/ui$/, replacement: resolve(repo, 'packages/ui/src/index.ts') },
      { find: /^@crsp\/ui\/(.*)$/, replacement: resolve(repo, 'packages/ui/src/$1') },
      { find: '@crsp/contract', replacement: resolve(web, 'node_modules/@crsp/contract') },
      { find: 'react', replacement: resolve(web, 'node_modules/react') },
      { find: 'react-dom', replacement: resolve(web, 'node_modules/react-dom') },
      { find: 'react-router-dom', replacement: resolve(web, 'node_modules/react-router-dom') },
      { find: '@testing-library/react', replacement: resolve(web, 'node_modules/@testing-library/react') },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: { fs: { allow: [repo] } },
};
