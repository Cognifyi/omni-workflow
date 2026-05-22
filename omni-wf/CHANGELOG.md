# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] — 2026-05-22

### Added

- **Omni Workflow SKILL.md** — Full orchestrator skill with INCEPTION → CONSTRUCTION → TEST → SHIP pipeline
  - INCEPTION: 5 sub-phases (Office Hours, CEO Review, Eng Review, Design Review, PRD Finalization)
  - CONSTRUCTION: Issue splitting, TDD with aidlc construction rules, per-Issue review/QA/test
  - TEST: Integration tests, browser validation, design audit, security audit, bug investigation
  - SHIP: Pre-merge review, performance baseline, release, deploy, canary
- **Subagent execution architecture** — Context isolation for large tasks
  - Direct execution, subagent delegation, verification subagent, parallel execution (max 3)
  - Minimal Context Package JSON protocol between Orchestrator and Executor
  - Subagent Queue tracking in state.md
- **MCP Server** — 17 tools for workflow status, phase advancement, evidence validation, decision logging
- **Auto-advance via self-validation** — No human confirmation gates; evidence-gated transitions
- **Evidence tracking** — Phase Completion Evidence mandatory in state.md for every transition
- **Per-Issue review enforcement** — `.omni-wf/reviews/issue-NNN.md` required before Issue close
- **omni-wf-state CLI** — Bash helper for local state, PRD, issue, and decision operations
- **Tests** — 14 passing tests (skill validation + MCP server integration)
- **USAGE.md** — User guide with 5 prompt patterns and input examples
- **README.md** — English-first project reference with Chinese links

### Changed

- CRITICAL constraints softened: "立即停止" → "自动修正并记录"
- Phase transition protocol: AskUserQuestion gates → self-verify → auto-advance
- Error recovery: halt-and-wait → retry / degrade / rollback

### Removed

- Manual confirmation checkpoints at every phase boundary
- `allowed-tools` frontmatter (removed to avoid blocking downstream skills)
