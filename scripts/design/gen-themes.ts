// Writes the theme part of packages/ui/src/tokens.css. Run: node --experimental-strip-types scripts/design/gen-themes.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { MARKERS, renderThemeCss } from './themes.ts';

const path = new URL('../../packages/ui/src/tokens.css', import.meta.url);
const css = readFileSync(path, 'utf8');
const block = renderThemeCss();
const a = css.indexOf(MARKERS.START);
const b = css.indexOf(MARKERS.END);
if (a < 0 || b < 0)
  throw new Error('tokens.css has no themes:start and themes:end markers');
writeFileSync(path, css.slice(0, a) + block + css.slice(b + MARKERS.END.length));
