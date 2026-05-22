#!/usr/bin/env bash
# Install matt-skills dependencies
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MATT_SKILLS_DIR="$REPO_ROOT/matt-skills"

if [ ! -d "$MATT_SKILLS_DIR" ]; then
  echo "Error: matt-skills directory not found at $MATT_SKILLS_DIR" >&2
  echo "Please ensure git submodules are initialized:" >&2
  echo "  git submodule update --init" >&2
  exit 1
fi

echo "=== Installing matt-skills ==="
cd "$MATT_SKILLS_DIR"
./scripts/link-skills.sh
