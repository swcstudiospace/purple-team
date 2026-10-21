#!/usr/bin/env bash
# Headless install-and-launch check for the Linux desktop bundles (phase 41,
# AC-41-01..10). Runs INSIDE a fresh ubuntu:22.04 container started by the
# `install-launch` job in .github/workflows/tauri-build.yml: no DISPLAY, no X
# server, no window system.
#
# Usage: desktop-install-launch-check.sh <artifact-dir> <receipt-dir>
#   <artifact-dir> holds the .deb and .AppImage from the desktop-linux artifact.
#   <receipt-dir>  receives receipt.json (machine-readable) and summary.md.
#
# Each check records exactly one status: pass | fail | not-applicable.
#   headless-no-display       no DISPLAY / WAYLAND_DISPLAY / X11 socket            (AC-41-02)
#   deb-install               apt-get install -y ./<pkg>.deb exits 0               (AC-41-03)
#   deb-dpkg-status           dpkg -s reports "install ok installed"               (AC-41-03)
#   deb-ldd                   ldd on each installed ELF executable: no "not found" (AC-41-04)
#   deb-sidecar-health        installed t3mp3st-server answers /health 200; exit recorded (AC-41-05)
#   appimage-extract-no-fuse  AppImage extracts with --appimage-extract, no FUSE    (AC-41-06)
#   appimage-sidecar-health   bundled sidecar answers /health 200, else n/a         (AC-41-06)
#
# Exit 0 only when every check passed or is not-applicable. Exit 1 on any
# failure or when the run stops before its last line (fail closed).
set -uo pipefail

ARTIFACT_DIR="${1:?usage: $0 <artifact-dir> <receipt-dir>}"
RECEIPT_DIR="${2:?usage: $0 <artifact-dir> <receipt-dir>}"

# Claim boundary, verbatim from AC-41-08. Written into receipt.json and summary.md.
CLAIM_BOUNDARY="headless install + ldd + sidecar /health only; no GUI window or desktop session was launched."
SIDECAR_PORT=3333
HEALTH_DEADLINE_S="${HEALTH_DEADLINE_S:-60}"
CONTAINER_IMAGE="${CONTAINER_IMAGE:-unknown}"
SOURCE_SHA="${SOURCE_SHA:-unknown}"
SOURCE_RUN_ID="${SOURCE_RUN_ID:-unknown}"
CI_ARTIFACT="${CI_ARTIFACT:-unknown}"

WORK="$(mktemp -d)"
CHECKS="$WORK/checks.ndjson"
ARTIFACTS="$WORK/artifacts.ndjson"
: >"$CHECKS"
: >"$ARTIFACTS"
RUN_COMPLETE=0
RECORD_ERRORS=0

export DEBIAN_FRONTEND=noninteractive

# Bootstrap tools needed to write the receipt. Failure here stops the job with
# no receipt; the workflow treats a missing receipt as a failed run.
if ! { apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl jq; } \
  >"$WORK/apt-base.log" 2>&1; then
  echo "[desktop-check] FATAL: cannot install ca-certificates, curl and jq" >&2
  cat "$WORK/apt-base.log" >&2
  exit 1
fi

record_check() { # <id> <pass|fail|not-applicable> <detail> [exit_code]
  local exit_code="${4:-}"
  jq -cn --arg id "$1" --arg status "$2" --arg detail "$3" --arg exit_code "$exit_code" \
    '{id: $id, status: $status, detail: $detail}
     + (if $exit_code == "" then {} else {exit_code: ($exit_code | tonumber)} end)' >>"$CHECKS" || RECORD_ERRORS=$((RECORD_ERRORS + 1))
  echo "[desktop-check] $1: $2 - $3"
}

record_artifact() { # <kind> <path>
  local sha bytes
  sha="$(sha256sum "$2" | cut -d' ' -f1)"
  bytes="$(stat -c %s "$2")"
  jq -cn --arg kind "$1" --arg file "$(basename "$2")" --arg sha256 "$sha" --argjson bytes "$bytes" \
    '{kind: $kind, file: $file, sha256: $sha256, bytes: $bytes}' >>"$ARTIFACTS" || RECORD_ERRORS=$((RECORD_ERRORS + 1))
}

# write_receipt <overall>: writes receipt.json, then fails unless the bytes on disk
# parse, carry the schema and verdict, and hold one entry per recorded check. A full
# or read-only volume can leave an empty or partial file, so the saved file is checked.
write_receipt() {
  jq -n \
    --arg schema "desktop-install-launch/v1" \
    --arg boundary "$CLAIM_BOUNDARY" \
    --arg overall "$1" \
    --arg container_image "$CONTAINER_IMAGE" \
    --arg source_sha "$SOURCE_SHA" \
    --arg source_run_id "$SOURCE_RUN_ID" \
    --arg ci_artifact "$CI_ARTIFACT" \
    --slurpfile artifacts "$ARTIFACTS" \
    --slurpfile checks "$CHECKS" \
    '{schema: $schema,
      claim_boundary: $boundary,
      overall: $overall,
      container: {image: $container_image},
      source: {sha: $source_sha, run_id: $source_run_id},
      ci_artifact: $ci_artifact,
      artifacts: $artifacts,
      checks: $checks}' >"$RECEIPT_DIR/receipt.json" || return 1
  jq -e --arg overall "$1" --argjson expected "$(jq -s length "$CHECKS")" \
    '.schema == "desktop-install-launch/v1" and .overall == $overall and (.checks | length) == $expected' \
    "$RECEIPT_DIR/receipt.json" >/dev/null
}

finish() {
  trap - EXIT
  local overall=pass fails
  fails="$(jq -s '[.[] | select(.status == "fail")] | length' "$CHECKS" 2>/dev/null || echo error)"
  if [ "$RUN_COMPLETE" != 1 ] || [ "$RECORD_ERRORS" -ne 0 ] || [ ! -s "$CHECKS" ] || [ "$fails" != 0 ]; then
    overall=fail
  fi
  # Summary first, receipt last: a receipt on disk implies the summary was written too.
  {
    echo "## Desktop install and launch (Linux, headless)"
    echo
    echo "Claim boundary: $CLAIM_BOUNDARY"
    echo
    echo "Overall: **$overall** (container \`$CONTAINER_IMAGE\`)"
    echo
    echo "| Check | Status | Detail |"
    echo "| --- | --- | --- |"
    jq -r '"| \(.id) | \(.status) | \(.detail) |"' "$CHECKS"
  } >"$RECEIPT_DIR/summary.md" || {
    echo "[desktop-check] FATAL: cannot write summary.md in $RECEIPT_DIR" >&2
    exit 1
  }
  if ! write_receipt "$overall"; then
    echo "[desktop-check] FATAL: receipt.json was not written or failed validation in $RECEIPT_DIR" >&2
    exit 1
  fi
  if [ "$overall" != pass ]; then
    echo "[desktop-check] FAILED: see $RECEIPT_DIR/receipt.json" >&2
    exit 1
  fi
  exit 0
}
trap finish EXIT

# start_sidecar_check <check-id> <binary> <cwd>
# Starts the sidecar headless with a bearer token, polls /health until HTTP 200
# or the deadline, stops it (SIGTERM, SIGKILL after 10 s) and records its exit.
# The token is generated per run and never written anywhere.
start_sidecar_check() {
  local id="$1" bin="$2" cwd="$3" token pid watchdog http="000" rc deadline log="$WORK/$1.log"
  token="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  (
    cd "$cwd" || exit 1
    export T3MP3ST_PORT="$SIDECAR_PORT" T3MP3ST_BEARER_TOKEN="$token"
    exec "$bin"
  ) >"$log" 2>&1 &
  pid=$!
  deadline=$((SECONDS + HEALTH_DEADLINE_S))
  while [ "$SECONDS" -lt "$deadline" ]; do
    kill -0 "$pid" 2>/dev/null || break
    http="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
      -H "Authorization: Bearer $token" "http://127.0.0.1:$SIDECAR_PORT/health" || true)"
    [ "$http" = 200 ] && break
    sleep 1
  done
  kill -TERM "$pid" 2>/dev/null || true
  ( sleep 10; kill -KILL "$pid" 2>/dev/null ) &
  watchdog=$!
  wait "$pid"
  rc=$?
  kill "$watchdog" 2>/dev/null || true
  wait "$watchdog" 2>/dev/null || true
  if [ "$http" = 200 ]; then
    record_check "$id" pass "GET /health returned 200 on 127.0.0.1:$SIDECAR_PORT; sidecar stopped, exit code $rc" "$rc"
  else
    echo "[desktop-check] $id sidecar log follows:" >&2
    cat "$log" >&2
    record_check "$id" fail "GET /health did not return 200 within ${HEALTH_DEADLINE_S}s (last HTTP $http); sidecar stopped, exit code $rc" "$rc"
  fi
}

check_deb_linkage() { # <package>
  local pkg="$1" path out flat rc checked=0 static=0
  local -a missing=() broken=()
  while IFS= read -r path; do
    if [ ! -f "$path" ] || [ ! -x "$path" ]; then continue; fi
    [ "$(head -c 4 "$path")" = $'\177ELF' ] || continue
    out="$(ldd "$path" 2>&1)"
    rc=$?
    flat="${out//$'\n'/ | }"
    if grep -q 'not found' <<<"$out"; then
      missing+=("$path: ${flat:-<no output>}")
    elif grep -qE 'not a dynamic executable|statically linked' <<<"$out"; then
      static=$((static + 1))
    elif [ "$rc" -ne 0 ]; then
      broken+=("$path (ldd exit $rc): ${flat:-<no output>}")
    else
      checked=$((checked + 1))
    fi
  done < <(dpkg -L "$pkg")
  if [ "${#missing[@]}" -gt 0 ] || [ "${#broken[@]}" -gt 0 ]; then
    record_check deb-ldd fail "ldd problems: not-found=[${missing[*]:-none}] failing=[${broken[*]:-none}]"
  elif [ "$checked" -eq 0 ] && [ "$static" -eq 0 ]; then
    record_check deb-ldd fail "no ELF executables found in package $pkg"
  else
    record_check deb-ldd pass "ldd reports no 'not found' for $checked dynamic and $static static ELF executable(s) in $pkg"
  fi
}

check_deb_sidecar() { # <package>
  local pkg="$1" sidecar resource_root="" path
  sidecar="$(dpkg -L "$pkg" | grep -m1 '/t3mp3st-server$' || true)"
  if [ -z "$sidecar" ] || [ ! -x "$sidecar" ]; then
    record_check deb-sidecar-health fail "package $pkg does not ship an executable t3mp3st-server"
    return 0
  fi
  # Same cwd rule as src-tauri/src/lib.rs: the resource dir when it holds docs/, else the binary dir.
  while IFS= read -r path; do
    if [ -d "$path" ] && [ "$(basename "$path")" = docs ]; then
      resource_root="$(dirname "$path")"
      break
    fi
  done < <(dpkg -L "$pkg")
  start_sidecar_check deb-sidecar-health "$sidecar" "${resource_root:-$(dirname "$sidecar")}"
}

deb_check() { # <path to .deb in artifact dir>
  local deb pkg="" rc
  deb="$WORK/$(basename "$1")"
  cp "$1" "$deb"
  record_artifact deb "$deb"
  pkg="$(dpkg-deb -f "$deb" Package 2>/dev/null || true)"
  (cd "$WORK" && apt-get install -y "./$(basename "$deb")") >"$WORK/apt-install.log" 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    record_check deb-install pass "apt-get install -y ./$(basename "$deb") exited 0" "$rc"
  else
    record_check deb-install fail "apt-get install -y ./$(basename "$deb") exited $rc; log tail: $(tail -n 3 "$WORK/apt-install.log" | tr '\n' ' ')" "$rc"
  fi
  local status=""
  [ -n "$pkg" ] && status="$(dpkg -s "$pkg" 2>/dev/null || true)"
  if [ -n "$status" ] && grep -qx 'Status: install ok installed' <<<"$status"; then
    record_check deb-dpkg-status pass "dpkg -s $pkg reports install ok installed"
  else
    record_check deb-dpkg-status fail "dpkg -s ${pkg:-<unknown package>} does not report install ok installed"
  fi
  if [ "$rc" -ne 0 ] || [ -z "$pkg" ]; then
    record_check deb-ldd fail "not run: package install did not succeed"
    record_check deb-sidecar-health fail "not run: package install did not succeed"
    return 0
  fi
  check_deb_linkage "$pkg"
  check_deb_sidecar "$pkg"
}

appimage_check() { # <path to .AppImage in artifact dir>
  local app root="$WORK/squashfs-root" rc sidecar resource_root="" fuse="absent" path
  app="$WORK/$(basename "$1")"
  cp "$1" "$app"
  chmod +x "$app"
  record_artifact appimage "$app"
  [ -e /dev/fuse ] && fuse="present"
  (cd "$WORK" && "$app" --appimage-extract) >"$WORK/appimage-extract.log" 2>&1
  rc=$?
  if [ "$rc" -eq 0 ] && [ -x "$root/AppRun" ]; then
    record_check appimage-extract-no-fuse pass "--appimage-extract exited 0 and produced squashfs-root/AppRun; /dev/fuse $fuse, no FUSE mount used" "$rc"
  else
    record_check appimage-extract-no-fuse fail "--appimage-extract exited $rc; squashfs-root/AppRun present: $([ -x "$root/AppRun" ] && echo yes || echo no); /dev/fuse $fuse" "$rc"
    echo "[desktop-check] appimage-extract log follows:" >&2
    cat "$WORK/appimage-extract.log" >&2
    record_check appimage-sidecar-health fail "not run: AppImage extraction failed"
    return 0
  fi
  sidecar="$(find "$root" -type f -name t3mp3st-server 2>/dev/null | head -n 1)"
  if [ -z "$sidecar" ]; then
    record_check appimage-sidecar-health not-applicable "AppImage does not bundle t3mp3st-server; not a pass"
    return 0
  fi
  if [ ! -x "$sidecar" ]; then
    record_check appimage-sidecar-health fail "AppImage t3mp3st-server is not executable in the extracted tree; permissions are not repaired"
    return 0
  fi
  while IFS= read -r path; do
    if [ -d "$path" ] && [ "$(basename "$path")" = docs ]; then
      resource_root="$(dirname "$path")"
      break
    fi
  done < <(find "$root" -type d -name docs 2>/dev/null)
  start_sidecar_check appimage-sidecar-health "$sidecar" "${resource_root:-$(dirname "$sidecar")}"
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

# AC-41-02: no display of any kind in the container.
if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ] || [ -e /tmp/.X11-unix ]; then
  record_check headless-no-display fail "display environment or X11 socket present in the container"
else
  record_check headless-no-display pass "DISPLAY and WAYLAND_DISPLAY unset; no X11 socket in the container"
fi

mapfile -t DEBS < <(find "$ARTIFACT_DIR" -type f -name '*.deb' | sort)
mapfile -t APPIMAGES < <(find "$ARTIFACT_DIR" -type f -name '*.AppImage' | sort)

if [ "${#DEBS[@]}" -eq 1 ]; then
  deb_check "${DEBS[0]}"
else
  record_check deb-install fail "expected exactly one .deb in the artifact dir, found ${#DEBS[@]}"
  record_check deb-dpkg-status fail "not run: no single .deb to install"
  record_check deb-ldd fail "not run: no single .deb to install"
  record_check deb-sidecar-health fail "not run: no single .deb to install"
fi

if [ "${#APPIMAGES[@]}" -eq 1 ]; then
  appimage_check "${APPIMAGES[0]}"
else
  record_check appimage-extract-no-fuse fail "expected exactly one .AppImage in the artifact dir, found ${#APPIMAGES[@]}"
  record_check appimage-sidecar-health fail "not run: no single .AppImage"
fi

RUN_COMPLETE=1
finish
