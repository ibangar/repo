#!/usr/bin/env bash
# Install the Higgsfield CLI (`hf`) without relying on the npm postinstall step.
#
# The official `npm i -g @higgsfield/cli` package downloads its Go binary in a
# postinstall script that uses Node's `https` module directly. Node ignores
# HTTPS_PROXY there, so the install hangs in any sandbox or CI runner that only
# has proxied egress. This script fetches the same release asset with curl,
# which does honour the proxy.
#
# Usage:
#   ./scripts/install-higgsfield.sh              # install to ~/.local/bin
#   PREFIX=/usr/local ./scripts/install-higgsfield.sh
#   HIGGSFIELD_VERSION=1.1.24 ./scripts/install-higgsfield.sh

set -euo pipefail

REPO="higgsfield-ai/cli"
PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"

case "$(uname -s)" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# Known-good version, used when neither lookup below is reachable. Some
# sandboxes (Claude Code on the web among them) allow the release *download*
# host but return 403 for the GitHub API and the /releases/latest redirect.
DEFAULT_VERSION="1.1.24"

resolve_version() {
  # 1) GitHub API.
  curl -fsSL --max-time 20 "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
    | sed -n 's/.*"tag_name" *: *"v\{0,1\}\([^"]*\)".*/\1/p' | head -1 && return 0
  return 1
}

resolve_version_redirect() {
  # 2) Follow the /releases/latest redirect, which ends at .../tag/vX.Y.Z.
  curl -fsSI --max-time 20 "https://github.com/$REPO/releases/latest" 2>/dev/null \
    | sed -n 's|.*location:.*/tag/v\{0,1\}\([0-9][^ \r]*\).*|\1|Ip' | head -1 && return 0
  return 1
}

VERSION="${HIGGSFIELD_VERSION:-}"
if [ -z "$VERSION" ]; then
  echo "Resolving latest release..."
  VERSION="$(resolve_version || true)"
  [ -z "$VERSION" ] && VERSION="$(resolve_version_redirect || true)"
fi
if [ -z "$VERSION" ]; then
  VERSION="$DEFAULT_VERSION"
  echo "Version lookup unavailable; falling back to pinned v$VERSION."
  echo "Override with HIGGSFIELD_VERSION=<x.y.z> if you need a newer build."
fi

BIN_NAME="hf"
[ "$OS" = "windows" ] && BIN_NAME="hf.exe"
TARBALL="hf_${VERSION}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/$REPO/releases/download/v${VERSION}/${TARBALL}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fsSL --retry 3 --retry-delay 2 -o "$TMP/$TARBALL" "$URL"
tar xzf "$TMP/$TARBALL" -C "$TMP"

if [ ! -f "$TMP/$BIN_NAME" ]; then
  echo "$BIN_NAME not found in $TARBALL" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
install -m 755 "$TMP/$BIN_NAME" "$BIN_DIR/$BIN_NAME"
ln -sf "$BIN_DIR/$BIN_NAME" "$BIN_DIR/higgsfield"

echo "Installed: $("$BIN_DIR/$BIN_NAME" --version)"
echo "Location:  $BIN_DIR/$BIN_NAME (alias: higgsfield)"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo; echo "NOTE: $BIN_DIR is not on your PATH. Add it:"
     echo "  export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

echo
echo "Next: hf auth login    (opens a browser for OAuth sign-in)"
