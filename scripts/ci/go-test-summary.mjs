// Reads `go test -json` on stdin. Writes every line unchanged to the file given
// as argv[2] (the per-test times stay available as a CI artifact), prints one
// line per finished package as it ends, and at the end prints the output of
// every failed test, the package times and the 20 slowest tests (CRSP201).
// The log stays small: it replaces `go test -v`, about 122k lines.
//
// Exit 0 when at least one test passed, 3 when none did (the zero-test guard,
// STACKSPEC 11.3). The caller combines this with go test's own exit code.
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';

const file = process.argv[2];
if (!file) {
  console.error('usage: go-test-summary.mjs <json-file>');
  process.exit(4);
}
mkdirSync(dirname(file), { recursive: true });
const sink = createWriteStream(file);

const out = new Map(); // "pkg\ttest" -> output lines of that test ("" test = package)
const buildOut = new Map(); // import path -> build output
const failedTests = [];
const failedPkgs = new Set();
const buildFailed = new Set();
const pkgTimes = new Map();
const testTimes = [];
let passed = 0;
let failed = 0;
let skipped = 0;
let other = 0;

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  sink.write(line + '\n');
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    // Not JSON (a tool wrote to stdout): keep it visible.
    console.log(line);
    other++;
    continue;
  }
  const pkg = e.Package ?? e.ImportPath ?? '';
  const key = `${pkg}\t${e.Test ?? ''}`;
  switch (e.Action) {
    case 'output':
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(e.Output);
      break;
    case 'build-output':
      if (!buildOut.has(e.ImportPath)) buildOut.set(e.ImportPath, []);
      buildOut.get(e.ImportPath).push(e.Output);
      break;
    case 'build-fail':
      buildFailed.add(e.ImportPath);
      break;
    case 'pass':
    case 'fail':
    case 'skip':
      if (e.Test) {
        if (e.Action === 'pass') passed++;
        else if (e.Action === 'fail') {
          failed++;
          failedTests.push(key);
        } else skipped++;
        if (typeof e.Elapsed === 'number')
          testTimes.push({ pkg, test: e.Test, s: e.Elapsed });
      } else {
        if (e.Action === 'fail') failedPkgs.add(pkg);
        if (typeof e.Elapsed === 'number') pkgTimes.set(pkg, e.Elapsed);
        console.log(
          `${e.Action === 'pass' ? 'ok  ' : e.Action === 'fail' ? 'FAIL' : 'skip'} ${pkg}  ${(e.Elapsed ?? 0).toFixed(1)}s`,
        );
      }
      break;
  }
}
await new Promise((r) => sink.end(r));

const text = (k) => (out.get(k) ?? []).join('');
for (const imp of buildFailed) {
  console.log(`\n=== build failed: ${imp}\n${(buildOut.get(imp) ?? []).join('')}`);
}
// A package that failed with no failed test of its own (panic, timeout, os.Exit).
const pkgsWithFailedTest = new Set(failedTests.map((k) => k.split('\t')[0]));
for (const pkg of failedPkgs) {
  if (!pkgsWithFailedTest.has(pkg) && !buildFailed.has(pkg)) {
    console.log(`\n=== package failed: ${pkg}\n${text(`${pkg}\t`)}`);
  }
}
for (const k of failedTests) {
  const [pkg, test] = k.split('\t');
  console.log(`\n=== FAIL ${pkg} ${test}\n${text(k)}`);
}

console.log('\n--- package times (s)');
for (const [pkg, s] of [...pkgTimes].sort((a, b) => b[1] - a[1])) {
  console.log(`${s.toFixed(1).padStart(8)}  ${pkg}`);
}
console.log('\n--- 20 slowest tests (s)');
for (const t of testTimes.sort((a, b) => b.s - a.s).slice(0, 20)) {
  console.log(`${t.s.toFixed(1).padStart(8)}  ${t.pkg} ${t.test}`);
}
console.log(
  `\ngo test: ${passed} passed, ${failed} failed, ${skipped} skipped; per-test times in ${file}`,
);
if (passed === 0) {
  console.error('zero-test guard: go test ran no passing tests');
  process.exit(3);
}
console.log(`zero-test guard: ${passed} passing tests`);
