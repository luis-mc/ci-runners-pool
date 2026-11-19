#!/usr/bin/env bash
# Real-machine test pass (OPS39): collect read-only facts about crsp on this
# Linux PC into one text file the owner can attach to a report.
# It changes nothing. Config: key names only, never values. Run: sudo bash check.sh
set -u

OUT="${1:-./crsp-check-$(hostname)-$(date -u +%Y%m%dT%H%M%SZ).txt}"
CONFIG="${CRSP_CONFIG:-/etc/crsp/config.toml}"
DATA_DIR="${CRSP_DATA_DIR:-/var/lib/crsp}"

section() { printf '\n== %s ==\n' "$1"; }

# Config keys: a line "key = value" gives "key"; values are never printed.
config_keys() {
  [ -r "$CONFIG" ] || { echo "config not readable: $CONFIG"; return; }
  sed -n 's/^[[:space:]]*\([A-Za-z0-9_.-][A-Za-z0-9_.-]*\)[[:space:]]*=.*/\1/p' "$CONFIG"
}

# Console port: the port of listen_addr in the config, 8460 when not set.
console_port() {
  local p=""
  if [ -r "$CONFIG" ]; then
    p=$(sed -n 's/^[[:space:]]*listen_addr[[:space:]]*=[[:space:]]*"\{0,1\}[^"]*:\([0-9][0-9]*\)"\{0,1\}[[:space:]]*$/\1/p' "$CONFIG" | head -n 1)
  fi
  if [ -n "${CRSP_LISTEN_ADDR:-}" ]; then p="${CRSP_LISTEN_ADDR##*:}"; fi
  echo "${p:-8460}"
}

show_json() { # file: print a small json file, or say why not
  if [ -r "$1" ]; then cat "$1"; echo; else echo "not found: $1"; fi
}

{
  echo "crsp real-machine check (OPS39)"
  echo "taken: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC"
  echo "host: $(hostname)"
  echo "os: $( (. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") || uname -sr )"
  echo "kernel: $(uname -r)  arch: $(uname -m)"

  section "installed binary"
  if command -v crsp >/dev/null 2>&1; then
    echo "path: $(command -v crsp)"
    crsp version 2>&1 | head -n 3
  else
    echo "crsp is not on PATH"
  fi
  if [ -r /usr/share/crsp/install-kind ]; then echo "install-kind: $(cat /usr/share/crsp/install-kind)"; else echo "install-kind: no marker (tar.gz install)"; fi

  PORT=$(console_port)
  section "version from /healthz (port $PORT)"
  if command -v curl >/dev/null 2>&1; then
    # Local address only; -k because the certificate is made by crsp's own CA.
    if ! curl -sS -k --max-time 5 "https://127.0.0.1:${PORT}/healthz" 2>&1; then
      echo
      echo "(https failed; trying plain http on 127.0.0.1)"
      curl -sS --max-time 5 "http://127.0.0.1:${PORT}/healthz" 2>&1 || echo "no answer"
    fi
    echo
  else
    echo "curl not installed"
  fi

  section "service state"
  if command -v systemctl >/dev/null 2>&1; then
    echo "crsp: active=$(systemctl is-active crsp 2>&1) enabled=$(systemctl is-enabled crsp 2>&1)"
    systemctl show crsp -p ActiveState -p SubState -p ActiveEnterTimestamp -p NRestarts 2>&1
  else
    echo "systemctl not found"
  fi

  section "runner services (actions.runner.*)"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl list-units --type=service --all --no-legend --plain --no-pager 'actions.runner.*' 2>&1
    echo "unit files:"
    systemctl list-unit-files --no-legend --no-pager 'actions.runner.*' 2>&1
  fi

  section "docker images crsp-pool:*"
  if command -v docker >/dev/null 2>&1; then
    docker image ls 'crsp-pool' --format '{{.Repository}}:{{.Tag}}  {{.Size}}  created {{.CreatedSince}}' 2>&1
    echo "containers named crsp-*:"
    docker ps -a --filter 'name=crsp-' --format '{{.Names}}  {{.Status}}' 2>&1
  else
    echo "docker not installed"
  fi

  section "disk use of the data folder ($DATA_DIR)"
  if [ -d "$DATA_DIR" ]; then
    du -sh "$DATA_DIR" 2>&1
    du -sh "$DATA_DIR"/* 2>/dev/null
    df -h "$DATA_DIR" 2>&1
  else
    echo "no data folder (an uninstall that removed the data, or a read without rights)"
  fi

  section "last update result.json"
  show_json "$DATA_DIR/updates/result.json"
  section "update stage.json"
  show_json "$DATA_DIR/updates/stage.json"

  section "config key names only ($CONFIG)"
  config_keys

  section "leftovers after an uninstall (look for anything listed here)"
  ls -d /usr/bin/crsp /var/lib/crsp /etc/crsp /etc/xdg/autostart/crsp-tray.desktop /usr/lib/systemd/system/crsp.service 2>&1
} >"$OUT" 2>&1

echo "Wrote $OUT"
