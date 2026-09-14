#!/usr/bin/env sh
set -eu

mkdir -p dist
version="${PULSED_VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"

build() {
  goos="$1"
  goarch="$2"
  ext="${3:-}"
  out="dist/pulsed-${goos}-${goarch}${ext}"
  echo "building ${out}"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags="-s -w -X main.appVersion=${version}" -o "$out" .
}

build linux amd64
build linux arm64
build darwin amd64
build darwin arm64
build windows amd64 .exe
build windows arm64 .exe

# Match the published assets exactly, even when dist already exists locally.
(
  cd dist
  set -- pulsed-linux-amd64 pulsed-linux-arm64 pulsed-darwin-amd64 \
    pulsed-darwin-arm64 pulsed-windows-amd64.exe pulsed-windows-arm64.exe
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@" > checksums.sha256
  else
    shasum -a 256 "$@" > checksums.sha256
  fi
)
