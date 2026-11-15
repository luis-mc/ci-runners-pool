#!/usr/bin/env bash
# CRSP90: write the release SBOMs (SPDX 2.3 JSON) into <out-dir>.
#
#   scripts/ci/release-sbom.sh <syft> <go-binary> <out-dir>
#
# crsp-sbom-go.spdx.json   the Go modules built into <go-binary> (read from the binary's build info)
# crsp-sbom-web.spdx.json  the npm packages of the web console, from pnpm-lock.yaml
#
# The names are stable (no version), so a release always carries the same two.
# <syft> is the path printed by `scripts/delivery/ci_tool.py tool syft`.
set -euo pipefail

[ "$#" -eq 3 ] || { echo "usage: $0 <syft> <go-binary> <out-dir>" >&2; exit 2; }
syft="$1" bin="$2" out="$3"
[ -x "$syft" ] || { echo "::error::syft not found or not executable: $syft" >&2; exit 1; }
[ -f "$bin" ] || { echo "::error::binary not found: $bin" >&2; exit 1; }
[ -f pnpm-lock.yaml ] || { echo "::error::run from the repository root (pnpm-lock.yaml not found)" >&2; exit 1; }

mkdir -p "$out"
export SYFT_CHECK_FOR_APP_UPDATE=false

"$syft" "file:$bin" --source-name crsp --select-catalogers go \
  -o "spdx-json=$out/crsp-sbom-go.spdx.json" -q
"$syft" "dir:." --source-name crsp-web --select-catalogers javascript \
  -o "spdx-json=$out/crsp-sbom-web.spdx.json" -q

for f in crsp-sbom-go crsp-sbom-web; do
  python3 -I - "$out/$f.spdx.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
n = len(d.get("packages", []))
if not str(d.get("spdxVersion", "")).startswith("SPDX-") or n < 2:
    sys.exit(f"{sys.argv[1]}: not a usable SPDX document ({n} packages)")
print(f"{sys.argv[1]}: {d['spdxVersion']}, {n} packages")
PY
done
