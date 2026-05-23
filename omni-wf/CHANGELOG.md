# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] — 2026-05-23

### Added

- **prd-audit skill** — Alternative entry point for when you already have a PRD
  - Phase 0: PRD load (local file, GitHub Issue, or pasted content)
  - Phase 1: Three-dimension PRD review (completeness, bugs/risks, improvements)
  - Phase 2: User choice A/B/C/D (fix scope selection)
  - Phase 3: PRD revision based on chosen scope
  - Phase 4: Issue split via `/to-issues`
  - Phase 5: Seamless handoff to omni-wf CONSTRUCTION → TEST → SHIP
- **MCP Server extended to 20 tools** — Added 3 PRD audit tools
  - `audit_prd`: record structured audit findings to `.omni-wf/prd-audits/`
  - `get_prd_audit`: read a specific PRD audit report
  - `list_prd_audits`: list all audit reports with score and verdict
- **Setup script** — Now installs both `omni-wf` and `prd-audit` skills
- **Plugin manifest** — `.claude-plugin/plugin.json` registers both skills
- **Tests** — 17 passing tests (added prd-audit SKILL.md structure validation + 3 MCP integration tests)

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
