#!/usr/bin/env bash
# Builds every screenshot of the review: baseline (the code of main) and options A, B, C (prototype patches).
# Needs: pnpm install done, Node 24, Playwright (NODE_PATH), a free port 5199. Leaves the working tree clean.
set -euo pipefail
root=$(git rev-parse --show-toplevel); cd "$root"
tools=docs/review/TRAY5/tools; out=docs/review/TRAY5/shots; pat=docs/review/TRAY5/patches
clean() { git reset -q -- apps/web; git checkout -- apps/web; rm -rf apps/web/src/proto apps/web/public/crsp-icon.png; }
(cd apps/web && pnpm exec vite --port 5199 --host 127.0.0.1 >/tmp/vite.log 2>&1 & echo $! >/tmp/vite.pid)
sleep 6; trap 'kill $(cat /tmp/vite.pid) 2>/dev/null; clean' EXIT
clean
node $tools/shoot.mjs http://127.0.0.1:5199 baseline $out/baseline 1100x880 > $out/baseline.log
node $tools/shoot.mjs http://127.0.0.1:5199 baseline $out/baseline-small 520x420 > $out/baseline-small.log
for o in A B C; do
  clean; $tools/proto/apply.sh $o; sleep 2
  node $tools/shoot.mjs http://127.0.0.1:5199 $o $out/$o > $out/$o.log
  git add -N apps/web/src/proto apps/web/public/crsp-icon.png
  git diff --binary -- apps/web > $pat/option-$o.patch
done
