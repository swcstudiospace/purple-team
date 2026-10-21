#!/usr/bin/env bash
# Restores the pre-linuxdeploy t3mp3st-server bytes in a Tauri-built Linux AppImage.
#
# linuxdeploy --appdir rewrites the RPATH of ELF files in the AppDir with patchelf.
# That inserts 8 KiB into the sidecar and breaks the pkg payload appended to it.
# This script extracts the AppImage, copies the sidecar from the build output back
# over the one inside the AppDir (only the sidecar bytes change), rebuilds the
# AppImage with appimagetool, and then re-extracts the result to confirm the
# sidecar is byte-identical to the source.
#
# usage: repack-linux-appimage.sh <AppImage> <sidecar source> <appimagetool>
set -euo pipefail

app="${1:?usage: $0 <AppImage> <sidecar source> <appimagetool>}"
src="${2:?usage: $0 <AppImage> <sidecar source> <appimagetool>}"
tool="${3:?usage: $0 <AppImage> <sidecar source> <appimagetool>}"

die() {
  echo "[repack-appimage] FATAL: $*" >&2
  exit 1
}

[ -f "$app" ] || die "AppImage not found: $app"
[ -f "$src" ] || die "sidecar source not found: $src"
[ -x "$tool" ] || die "appimagetool not executable: $tool"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp "$app" "$work/input.AppImage"
chmod +x "$work/input.AppImage"
mkdir "$work/extract-input"
(cd "$work/extract-input" && "$work/input.AppImage" --appimage-extract >"$work/extract-input.log" 2>&1) ||
  { cat "$work/extract-input.log" >&2; die "extracting $app failed"; }

appdir="$work/extract-input/squashfs-root"
mapfile -t sidecars < <(find "$appdir" -type f -name t3mp3st-server)
[ "${#sidecars[@]}" -eq 1 ] || die "expected one t3mp3st-server in the AppDir, found ${#sidecars[@]}"
echo "[repack-appimage] linuxdeploy sidecar: ${sidecars[0]#"$appdir"/} sha256 $(sha256sum "${sidecars[0]}" | cut -d' ' -f1)"

cp "$src" "${sidecars[0]}"
chmod 755 "${sidecars[0]}"

ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$tool" "$appdir" "$work/output.AppImage" >"$work/appimagetool.log" 2>&1 ||
  { cat "$work/appimagetool.log" >&2; die "appimagetool failed"; }

mkdir "$work/extract-output"
cp "$work/output.AppImage" "$work/output-check.AppImage"
chmod +x "$work/output-check.AppImage"
(cd "$work/extract-output" && "$work/output-check.AppImage" --appimage-extract >"$work/extract-output.log" 2>&1) ||
  { cat "$work/extract-output.log" >&2; die "re-extracting the rebuilt AppImage failed"; }

mapfile -t rebuilt < <(find "$work/extract-output/squashfs-root" -type f -name t3mp3st-server)
[ "${#rebuilt[@]}" -eq 1 ] || die "rebuilt AppImage has ${#rebuilt[@]} t3mp3st-server files"
want="$(sha256sum "$src" | cut -d' ' -f1)"
got="$(sha256sum "${rebuilt[0]}" | cut -d' ' -f1)"
[ "$got" = "$want" ] || die "rebuilt AppImage sidecar sha256 $got does not match source $want"

mv "$work/output.AppImage" "$app"
echo "[repack-appimage] rebuilt $app; sidecar sha256 $got equals source"
