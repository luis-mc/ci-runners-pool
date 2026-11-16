package joinfile

// The templates use << >> as delimiters so the shell's ${...} stays as written.
// Each file holds the one-time join code and nothing else secret. Packages are
// checked against the SHA-256 written into the file (from the release's
// SHA256SUMS, taken in the owner's signed-in session), so the download does not
// depend on trusting the controller's self-signed certificate; the join itself
// pins the certificate fingerprint.

const linuxTemplate = `#!/bin/sh
# crsp: join this machine to the controller. Made <<.Version>>, valid until <<.Expires>>.
# The join code below works once. Run: sh <this file>
set -eu

CONTROLLER='<<.Controller>>'
BASE='<<.Base>>'
FINGERPRINT='<<.Fingerprint>>'
JOIN_CODE='<<.Code>>'

say() { printf '%s\n' "$*"; }
die() { printf 'crsp join: %s\n' "$*" >&2; exit 1; }

sum_for() {
  case "$1" in
<<- range .Sums >>
    '<<.Name>>') say '<<.SHA256>>' ;;
<<- end >>
    *) say '' ;;
  esac
}

if [ "$(id -u)" -eq 0 ]; then
  SUDO=''
else
  command -v sudo >/dev/null 2>&1 || die 'sudo is needed to install. Run this file as root.'
  SUDO='sudo'
fi

case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) die "this processor is not supported: $(uname -m)" ;;
esac

hash_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  else die 'sha256sum is needed to check the download.'
  fi
}

fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL -k -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q --no-check-certificate -O "$2" "$1"
  else die 'curl or wget is needed to download the package.'
  fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

get_package() {
  want=$(sum_for "$1")
  [ -n "$want" ] || die "this controller has no package named $1."
  say "Downloading $1 from the controller..."
  fetch "$BASE/api/v1/packages/$1" "$TMP/$1" || die "could not download $1 from $BASE."
  got=$(hash_of "$TMP/$1")
  [ "$got" = "$want" ] || die "$1 does not match its SHA256SUMS entry. Nothing was installed."
  say "Checked the SHA-256 of $1."
}

if ! command -v crsp >/dev/null 2>&1; then
  if command -v dpkg >/dev/null 2>&1; then
    get_package "crsp-linux-$ARCH.deb"
    $SUDO dpkg -i "$TMP/crsp-linux-$ARCH.deb"
  elif command -v rpm >/dev/null 2>&1; then
    get_package "crsp-linux-$ARCH.rpm"
    $SUDO rpm -U "$TMP/crsp-linux-$ARCH.rpm"
  else
    get_package "crsp-linux-$ARCH.tar.gz"
    mkdir "$TMP/x"
    tar -xzf "$TMP/crsp-linux-$ARCH.tar.gz" -C "$TMP/x"
    BIN=$(find "$TMP/x" -type f -name crsp | head -n 1)
    [ -n "$BIN" ] || die 'the archive holds no crsp program.'
    $SUDO install -m 0755 "$BIN" /usr/local/bin/crsp
  fi
fi

CRSP=$(command -v crsp 2>/dev/null || say /usr/local/bin/crsp)
$SUDO "$CRSP" agent install --controller "$CONTROLLER" --fingerprint "$FINGERPRINT" --join-code "$JOIN_CODE"
say 'Done. This machine joins the pool; the console shows it in a moment.'
`

const macosTemplate = `#!/bin/sh
# crsp: join this Mac to the controller. Made <<.Version>>, valid until <<.Expires>>.
# The join code below works once. Double-click this file, or run: sh <this file>
set -eu

CONTROLLER='<<.Controller>>'
BASE='<<.Base>>'
FINGERPRINT='<<.Fingerprint>>'
JOIN_CODE='<<.Code>>'

say() { printf '%s\n' "$*"; }
die() { printf 'crsp join: %s\n' "$*" >&2; exit 1; }

sum_for() {
  case "$1" in
<<- range .Sums >>
    '<<.Name>>') say '<<.SHA256>>' ;;
<<- end >>
    *) say '' ;;
  esac
}

case "$(uname -m)" in
  x86_64) ARCH=amd64 ;;
  arm64) ARCH=arm64 ;;
  *) die "this processor is not supported: $(uname -m)" ;;
esac

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

if ! command -v crsp >/dev/null 2>&1 && [ ! -x /usr/local/bin/crsp ]; then
  PKG="crsp-darwin-$ARCH.pkg"
  want=$(sum_for "$PKG")
  [ -n "$want" ] || die "this controller has no package named $PKG."
  say "Downloading $PKG from the controller..."
  curl -fsSL -k -o "$TMP/$PKG" "$BASE/api/v1/packages/$PKG" || die "could not download $PKG from $BASE."
  got=$(shasum -a 256 "$TMP/$PKG" | cut -d' ' -f1)
  [ "$got" = "$want" ] || die "$PKG does not match its SHA256SUMS entry. Nothing was installed."
  say "Checked the SHA-256 of $PKG. macOS asks for your password to install it."
  sudo installer -pkg "$TMP/$PKG" -target /
fi

CRSP=$(command -v crsp 2>/dev/null || say /usr/local/bin/crsp)
sudo "$CRSP" agent install --controller "$CONTROLLER" --fingerprint "$FINGERPRINT" --join-code "$JOIN_CODE"
say 'Done. This Mac joins the pool; the console shows it in a moment.'
`

const windowsTemplate = `@echo off
rem crsp: join this PC to the controller. Made <<.Version>>, valid until <<.Expires>>.
rem The join code below works once. Double-click this file and accept the administrator prompt.
set "CRSP_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:CRSP_SELF); $i=$t.LastIndexOf('#--PS'+'-BODY--'); & ([ScriptBlock]::Create($t.Substring($i))) $env:CRSP_SELF"
set "CRSP_RC=%errorlevel%"
if "%CRSP_RC%"=="10" exit /b 0
echo.
pause
exit /b %CRSP_RC%
#--PS-BODY--
param($Self)
$ErrorActionPreference = 'Stop'
$Controller = '<<.Controller>>'
$Base = '<<.Base>>'
$Fingerprint = '<<.Fingerprint>>'
$JoinCode = '<<.Code>>'
$Sums = @{
<<- range .Sums >>
  '<<.Name>>' = '<<.SHA256>>'
<<- end >>
}
try {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c ""' + $Self + '""') -Verb RunAs
    exit 10
  }
  $crsp = $null
  $found = Get-Command crsp.exe -ErrorAction SilentlyContinue
  if ($found) { $crsp = $found.Source }
  if (-not $crsp) {
    $installed = Join-Path $env:ProgramFiles 'crsp\crsp.exe'
    if (Test-Path -LiteralPath $installed) { $crsp = $installed }
  }
  if (-not $crsp) {
    $arch = 'amd64'
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }
    $name = 'crsp-windows-' + $arch + '.msi'
    $want = $Sums[$name]
    if (-not $want) { throw ('This controller has no package named ' + $name + '.') }
    $dir = Join-Path $env:TEMP ('crsp-join-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $dir | Out-Null
    $msi = Join-Path $dir $name
    Add-Type -TypeDefinition 'using System.Net; public class CrspTrust { public static void Enable() { ServicePointManager.ServerCertificateValidationCallback = delegate { return true; }; } }'
    [CrspTrust]::Enable()
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]'Tls12,Tls13' } catch { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 }
    Write-Host ('Downloading ' + $name + ' from the controller...')
    (New-Object Net.WebClient).DownloadFile($Base + '/api/v1/packages/' + $name, $msi)
    $got = (Get-FileHash -Algorithm SHA256 -LiteralPath $msi).Hash.ToLower()
    if ($got -ne $want) { throw ($name + ' does not match its SHA256SUMS entry. Nothing was installed.') }
    Write-Host ('Checked the SHA-256 of ' + $name + '.')
    $run = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', ('"' + $msi + '"'), '/qn', '/norestart') -Wait -PassThru
    if (($run.ExitCode -ne 0) -and ($run.ExitCode -ne 3010)) { throw ('The installer stopped with code ' + $run.ExitCode + '.') }
    $crsp = Join-Path $env:ProgramFiles 'crsp\crsp.exe'
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
  }
  & $crsp agent install --controller $Controller --fingerprint $Fingerprint --join-code $JoinCode
  if ($LASTEXITCODE -ne 0) { throw ('crsp agent install stopped with code ' + $LASTEXITCODE + '.') }
  Write-Host 'Done. This PC joins the pool; the console shows it in a moment.'
  exit 0
} catch {
  Write-Host ('crsp join: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
`
