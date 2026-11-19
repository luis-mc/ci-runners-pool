#!/bin/sh
# Tests of install.sh (operations R5.1) with a fake release in a folder and a
# fake `gh` on PATH. No network. Run: sh scripts/install/install_test.sh
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT INT TERM
pass=0
failed=0

case "$(uname -s)" in Linux) os=linux ;; Darwin) os=darwin ;; *) echo "skip: $(uname -s)"; exit 0 ;; esac
case "$(uname -m)" in x86_64 | amd64) arch=amd64 ;; *) arch=arm64 ;; esac
target="$os-$arch"
name="crsp-${target}_0.1.15.tar.gz" # OPS40: the release version is in the name

sum() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{ print $1 }'; else shasum -a 256 "$1" | awk '{ print $1 }'; fi; }

# A fake release: an archive whose crsp records that it ran.
rel="$root/release"
mkdir -p "$rel" "$root/pkg/crsp-$target"
cat >"$root/pkg/crsp-$target/crsp" <<EOS
#!/bin/sh
echo "\$@" >"$root/crsp-ran"
EOS
chmod +x "$root/pkg/crsp-$target/crsp"
tar -C "$root/pkg" -czf "$rel/$name" "crsp-$target"
printf '%s  %s\n' "$(sum "$rel/$name")" "$name" >"$rel/SHA256SUMS"

# A fake gh: exit code and log from the test.
bin="$root/bin"
mkdir -p "$bin"
cat >"$bin/gh" <<EOS
#!/bin/sh
echo "\$@" >>"$root/gh-calls"
exit "\${FAKE_GH_EXIT:-0}"
EOS
chmod +x "$bin/gh"
# A PATH without gh: the system tools only, through links.
nogh="$root/nogh"
mkdir -p "$nogh"
for t in sh uname mktemp curl awk tar gzip gunzip rm sha256sum shasum cat dirname printf mkdir chmod; do
  p="$(command -v "$t" 2>/dev/null || true)"
  [ -n "$p" ] && [ -x "$p" ] && ln -sf "$p" "$nogh/$t"
done

run() { # run <path> [env...]: runs install.sh, output in $root/out
  rm -f "$root/crsp-ran" "$root/gh-calls"
  p="$1"
  shift
  env "$@" PATH="$p" CRSP_RELEASE_URL="file://$rel" sh "$here/install.sh" --mode controller >"$root/out" 2>&1
}

check() { # check <name> <condition exit code>
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); echo "ok   $1"; else failed=$((failed + 1)); echo "FAIL $1"; sed 's/^/     /' "$root/out"; fi
}

# TestGhPresentVerifiesTheFileAndInstalls
run "$bin:$nogh" FAKE_GH_EXIT=0
rc=$?
grep -q "attestation verify .*$name --repo luis-mc/ci-runners-shared-pool" "$root/gh-calls" 2>/dev/null
check "gh present: verifies the archive for this repo" $?
[ $rc -eq 0 ] && [ "$(cat "$root/crsp-ran" 2>/dev/null)" = "install --mode controller" ]
check "gh present and ok: runs crsp install with the arguments" $?

# TestGhFailureStopsBeforeInstall
run "$bin:$nogh" FAKE_GH_EXIT=1
rc=$?
[ $rc -ne 0 ] && [ ! -e "$root/crsp-ran" ] && grep -q "did not verify" "$root/out"
check "gh fails: stops, nothing installed" $?

# TestNoGhSaysChecksumOnlyAndContinues
run "$nogh"
rc=$?
[ $rc -eq 0 ] && [ -e "$root/crsp-ran" ] && grep -q "only the checksum was checked" "$root/out" && grep -q "gh attestation verify $name --repo luis-mc/ci-runners-shared-pool" "$root/out"
check "no gh: says checksum only, how to verify by hand, installs" $?

# TestBadChecksumStopsBeforeGh
printf '%s  %s\n' "0000000000000000000000000000000000000000000000000000000000000000" "$name" >"$rel/SHA256SUMS"
run "$bin:$nogh"
rc=$?
[ $rc -ne 0 ] && [ ! -e "$root/crsp-ran" ] && [ ! -e "$root/gh-calls" ] && grep -q "does not match" "$root/out"
check "bad checksum: stops before gh and before install" $?

# TestOlderReleaseWithPlainNameStillInstalls (releases up to 0.1.14)
plain="crsp-$target.tar.gz"
mv "$rel/$name" "$rel/$plain"
printf '%s  %s\n' "$(sum "$rel/$plain")" "$plain" >"$rel/SHA256SUMS"
run "$bin:$nogh" FAKE_GH_EXIT=0
rc=$?
[ $rc -eq 0 ] && [ -e "$root/crsp-ran" ] && grep -q "attestation verify .*$plain --repo" "$root/gh-calls" 2>/dev/null
check "older release: the plain archive name is found in SHA256SUMS and installs" $?

# TestNoArchiveInSumsStops
printf '%s  %s\n' "$(sum "$rel/$plain")" "crsp-other-os_0.1.15.tar.gz" >"$rel/SHA256SUMS"
run "$bin:$nogh"
rc=$?
[ $rc -ne 0 ] && [ ! -e "$root/crsp-ran" ] && grep -q "no archive for $target" "$root/out"
check "no archive for this machine in SHA256SUMS: stops" $?

echo "$pass passed, $failed failed"
[ "$failed" -eq 0 ]
