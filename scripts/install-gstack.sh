#!/usr/bin/env bash
# Install gstack dependencies
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GSTACK_DIR="$REPO_ROOT/gstack"

if [ ! -d "$GSTACK_DIR" ]; then
  echo "Error: gstack directory not found at $GSTACK_DIR" >&2
  echo "Please ensure git submodules are initialized:" >&2
  echo "  git submodule update --init" >&2
  exit 1
fi

echo "=== Installing gstack ==="
cd "$GSTACK_DIR"
./setup
