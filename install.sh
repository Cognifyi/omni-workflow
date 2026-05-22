#!/usr/bin/env bash
# Omni Skills Full Installer — installs gstack, matt-skills, and omni-wf
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
QUIET=0

log() { [ "$QUIET" -eq 0 ] && echo "$@" || true; }

while [ $# -gt 0 ]; do
  case "$1" in
    -q|--quiet) QUIET=1; shift ;;
    *) shift ;;
  esac
done

log "=== Omni Skills Full Installer ==="
log ""

# ─── Check git submodules ─────────────────────────────────────
if [ ! -d "$REPO_ROOT/gstack" ] || [ ! -d "$REPO_ROOT/matt-skills" ]; then
  log "Git submodules not initialized. Initializing..."
  git submodule update --init --recursive
  log ""
fi

# ─── Check and install gstack ─────────────────────────────────
check_gstack_installed() {
  # Check for key gstack skills in standard locations
  local claude_skills="$HOME/.claude/skills"
  local codex_skills="$HOME/.codex/skills"
  
  # Check for a few key gstack skills
  if [ -d "$claude_skills" ] && [ -L "$claude_skills/qa" ]; then
    return 0
  fi
  if [ -d "$codex_skills" ] && [ -L "$codex_skills/gstack" ]; then
    return 0
  fi
  return 1
}

if check_gstack_installed; then
  log "✓ gstack already installed"
else
  log "Installing gstack..."
  bash "$SCRIPT_DIR/scripts/install-gstack.sh"
  log ""
fi

# ─── Check and install matt-skills ─────────────────────────────
check_matt_skills_installed() {
  local claude_skills="$HOME/.claude/skills"
  
  # Check for key matt-skills
  if [ -d "$claude_skills" ] && [ -L "$claude_skills/tdd" ]; then
    return 0
  fi
  return 1
}

if check_matt_skills_installed; then
  log "✓ matt-skills already installed"
else
  log "Installing matt-skills..."
  bash "$SCRIPT_DIR/scripts/install-matt-skills.sh"
  log ""
fi

# ─── Install omni-wf ─────────────────────────────────────────
log "Installing omni-wf..."
bash "$REPO_ROOT/omni-wf/setup"

log ""
log "=== Installation complete ==="
log ""
log "All dependencies installed:"
log "  • gstack (review, QA, ship, deployment skills)"
log "  • matt-skills (TDD, PRD, issue splitting)"
log "  • omni-wf (workflow orchestrator)"
log ""
log "Invoke the workflow in Claude Code with: /omni-wf"
