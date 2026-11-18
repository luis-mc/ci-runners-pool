import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The scanner behind `action-bar.test.ts` (design system UX-71): a screen's primary button is drawn inside the
 * shared action bar (`<ActionBar primary={...} />`), never anywhere else, and the bar holds one primary.
 * Shared UI folders (the question card, the wizard) are not judged: they are the parts.
 */
export const CONFIG = {
  appPaths: ['apps/'],
  sharedPaths: ['packages/ui/'],
  fileGlobs: ['.tsx'],
};

export interface Breach {
  readonly file: string;
  readonly kind: 'outside' | 'many';
}

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.turbo',
  'coverage',
  '__tests__',
  'tests',
]);
const TEST_FILE = /\.(test|spec)\./;
/** A button made primary: `kind="primary"`, `kind: 'primary'` or `kind={cond ? 'primary' : ...}`. */
const PRIMARY =
  /kind\s*(?:=\s*(?:"primary"|\{[^}]*['"]primary['"][^}]*\})|:\s*['"]primary['"])/g;

export function isTestPath(file: string): boolean {
  const parts = file.split('/');
  return (
    TEST_FILE.test(parts[parts.length - 1] as string) ||
    parts.slice(0, -1).some((p) => p === '__tests__' || p === 'tests')
  );
}

function isUnder(file: string, folders: readonly string[]): boolean {
  return folders.some((f) => file.startsWith(f.endsWith('/') ? f : f + '/'));
}

/** The text spans of every `primary={...}` prop of an `<ActionBar`, found by matching braces. */
function barSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of text.matchAll(/<ActionBar(?=[\s/>])/g)) {
    const at = text.indexOf('primary={', m.index);
    if (at < 0) continue;
    let depth = 0;
    let i = at + 'primary='.length;
    const start = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    spans.push([start, i]);
  }
  return spans;
}

export function scanText(file: string, text: string, config = CONFIG): Breach[] {
  if (isTestPath(file) || isUnder(file, config.sharedPaths)) return [];
  if (!config.fileGlobs.some((g) => file.endsWith(g))) return [];
  const spans = barSpans(text);
  const found: Breach[] = [];
  const perBar = new Map<number, number>();
  for (const m of text.matchAll(PRIMARY)) {
    const bar = spans.findIndex(([a, b]) => m.index >= a && m.index <= b);
    if (bar < 0) found.push({ file, kind: 'outside' });
    else perBar.set(bar, (perBar.get(bar) ?? 0) + 1);
  }
  for (const n of perBar.values()) if (n > 1) found.push({ file, kind: 'many' });
  return found;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path, out);
    } else out.push(path);
  }
}

export function scanApps(root: string, config = CONFIG): Breach[] {
  const found: Breach[] = [];
  for (const app of config.appPaths) {
    const files: string[] = [];
    walk(join(root, app), files);
    for (const file of files.sort()) {
      const rel = relative(root, file).split('\\').join('/');
      found.push(...scanText(rel, readFileSync(file, 'utf8'), config));
    }
  }
  return found;
}

export function countBreaches(found: readonly Breach[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of found)
    counts.set(`${b.file}|${b.kind}`, (counts.get(`${b.file}|${b.kind}`) ?? 0) + 1);
  return counts;
}

export interface KnownEntry {
  file: string;
  kind: string;
  count: number;
}

/** The ratchet: a count above its listed one is new; a listed count above the real one is stale. */
export function judgeBreaches(
  actual: ReadonlyMap<string, number>,
  known: readonly KnownEntry[],
): { added: string[]; stale: string[] } {
  const listed = new Map(known.map((e) => [`${e.file}|${e.kind}`, e.count]));
  const added: string[] = [];
  const stale: string[] = [];
  for (const [key, n] of actual) {
    const [file, kind] = key.split('|');
    const was = listed.get(key) ?? 0;
    if (n > was)
      added.push(
        `${file}: ${n - was} new primary ${kind === 'outside' ? 'outside the action bar' : 'extra in the action bar'}${was ? ` (${was} known)` : ''}`,
      );
  }
  for (const [key, was] of listed) {
    const n = actual.get(key) ?? 0;
    const [file, kind] = key.split('|');
    if (n < was)
      stale.push(
        `${file}: ${kind} known ${was}, now ${n}: lower or remove the entry in action-bar.known.json`,
      );
  }
  return { added, stale };
}
