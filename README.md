# Omni Workflow (omni-wf)

> Autonomous development workflow orchestrator. INCEPTION → CONSTRUCTION → TEST → SHIP, driven by AI agents.

Omni Workflow unifies [gstack](https://github.com/garrytan/gstack), [matt-skills](https://github.com/mattt/matt-skills), and aidlc-workflows into a single autonomous pipeline. It does not replace individual skills — it **orchestrates** them. The runtime is the AI agent itself.

**Two things make it different from a static checklist:**

1. **Self-validating auto-advance.** Every phase transition is gated by evidence, not by human approval. The agent checks its own work, records proof in `state.md`, and moves on.
2. **Subagent execution for huge tasks.** When context limits threaten, the orchestrator delegates entire Issue slices — TDD, review, QA — to isolated subagents. The main agent only sees structured summaries, never execution noise.

---

## Quick start

```bash
cd omni-wf
./setup
```

Then in Claude Code:

```
/omni-wf
```

The agent will:
1. Detect your repo's change scope
2. Route through INCEPTION → CONSTRUCTION → TEST → SHIP
3. Call the right specialist skill for each sub-phase
4. Record evidence to `.omni-wf/state.md`
5. Auto-advance when self-validation passes

---

## Dual-mode delivery

| Mode | What it is | When to use |
|------|-----------|-------------|
| **SKILL.md** | Agent-readable prompt orchestration | Claude Code, OpenCode, Codex |
| **MCP Server** | 17-tool stdio server for tool-based driving | Claude Desktop, any MCP client |

Install the skill:

```bash
./setup           # links to ~/.claude/skills/omni-wf
```

Install the MCP server (optional):

```bash
./setup --mcp
```

Then add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "omni-wf": {
      "command": "bun",
      "args": ["/path/to/omni-wf/mcp-server/dist/server.js"]
    }
  }
}
```

Build the server:

```bash
bun install
bun build          # outputs mcp-server/dist/server.js
bun test           # 14 tests — skill validation + MCP integration
```

---

## Workflow pipeline

```
INCEPTION (requirements + architecture lock)
  ├── 1.1 Office Hours     → /office-hours      → output: decision docs
  ├── 1.2 CEO Review       → /plan-ceo-review   → output: strategic decisions
  ├── 1.3 Eng Review        → /plan-eng-review   → output: architecture + spec
  ├── 1.4 Design Review     → /plan-design-review → output: design decisions (if frontend)
  └── 1.5 PRD Finalization  → /to-prd            → output: docs/prds/

CONSTRUCTION (vertical-slice coding)
  ├── 2.1 Issue Split        → /to-issues         → output: GitHub Issues (omni-wf label)
  ├── 2.2 Context Mgmt      → run_subagent       → output: isolated context + clean execution
  ├── 2.3 Per-Issue TDD     → /tdd               → output: code + tests
  ├── 2.4 Per-Issue Review  → /review            → output: .omni-wf/reviews/issue-NNN.md
  ├── 2.5 Per-Issue QA      → /qa                → output: QA report (if frontend)
  └── 2.6 Per-Issue Test    → npm test           → output: test pass record

TEST (system integration validation)
  ├── 3.1 Integration Tests
  ├── 3.2 Browser Validation (if HAS_FRONTEND > 0)
  ├── 3.3 Design Audit      (if HAS_FRONTEND > 0)
  ├── 3.4 Security Audit    (if HAS_SECURITY > 0)
  └── 3.5 Bug Investigation (if bugs found)

SHIP (release + deploy)
  ├── 4.1 Pre-merge Review
  ├── 4.2 Performance Baseline (if HAS_FRONTEND > 0)
  ├── 4.3 Release           → /ship
  ├── 4.4 Deploy            → /land-and-deploy
  └── 4.5 Canary            → /canary
```

### Cross-system mapping

| omni-wf | gstack | matt-skills | aidlc-workflows |
|---------|--------|-------------|-----------------|
| INCEPTION | `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review` | `/to-prd` | inception |
| CONSTRUCTION | `/tdd` + `/review` + `/qa` | `/tdd` + `/to-issues` | construction |
| TEST | `/qa` + `/design-review` + `/cso` + `/investigate` | — | construction (nfr) |
| SHIP | `/review` + `/benchmark` + `/ship` + `/land-and-deploy` + `/canary` | — | operations |

---

## Subagent execution architecture

The orchestrator never accumulates execution noise. For large tasks, it delegates.

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│   Orchestrator (main agent)     │      │   Subagent (Issue Executor)     │
├─────────────────────────────────┤      ├─────────────────────────────────┤
│ Maintains state.md              │◄────►│ Receives minimal context pkg    │
│ Decides direct vs delegate      │      │ Executes TDD + Review + Test    │
│ Verifies structured output      │◄────►│ No access to other Issues/PRDs  │
│ Updates global state            │      │ Returns evidence summary only   │
└─────────────────────────────────┘      └─────────────────────────────────┘
```

**Delegation rules**

| Condition | Mode |
|-----------|------|
| < 20 files, < 500 lines changed, context < 70% | Direct execution |
| >= 20 files or >= 500 lines or context >= 70% | Subagent delegate (TDD) |
| Post-TDD context >= 70% | **Verification subagent** (test + /review + /qa) |
| Multiple Issues with no dependencies | Parallel subagents (max 3) |

The verification subagent runs the full regression suite, gstack `/review`, and `/qa` — then returns a structured summary like:

```json
{
  "tests": { "status": "PASS", "total": 45, "failed": 0 },
  "review": { "status": "PASS", "critical_findings": [] },
  "regression_check": "no regression",
  "recommendation": "accept"
}
```

The orchestrator only sees the verdict. Context stays clean.

---

## Project structure

```
omni-wf/
├── omni-wf/
│   └── SKILL.md              # The orchestrator skill (prompt layer)
├── mcp-server/
│   ├── src/server.ts         # MCP server — 17 tools, evidence validation
│   └── dist/server.js          # Built output
├── bin/
│   └── omni-wf-state         # Bash helper for state/PRD/issue ops
├── test/
│   ├── skill-validation.test.ts   # SKILL.md structure validation
│   └── mcp-server.test.ts         # MCP server integration tests
├── docs/
│   └── workflow-guide.md     # Extended documentation
├── setup                     # Installer (skill + MCP)
├── package.json
└── tsconfig.json
```

Inside the target repo, the workflow produces:

```
your-project/
├── docs/
│   ├── prds/                 # PRDs from INCEPTION
│   ├── decisions/            # Decision logs from each review phase
│   ├── adr/                  # Architecture Decision Records
│   └── specs/                # Technical specifications
├── .omni-wf/
│   ├── state.md              # Phase, stage, evidence, subagent queue
│   └── reviews/              # Per-issue review + QA outputs
└── GitHub Issues             # Vertical slices with `omni-wf` label
```

---

## Core design decisions

**Self-validating auto-advance.** Phase transitions require evidence, not human clicks. The agent runs a checklist, records results to `state.md`, and advances automatically. If something is missing, it rolls back to the gap and fixes it — it does not stop and wait.

**Auto-correction over halt-and-wait.** When the workflow detects a deviation (skipped phase, missing evidence, wrong skill call), it logs the finding and attempts to self-correct first. Only unrecoverable blockers pause for human input.

**No tool restrictions on the orchestrator.** We removed `allowed-tools` from SKILL.md frontmatter. The orchestrator delegates tool choice to sub-skills (`/autoplan`, `/qa`, etc.). Hard-limiting tools blocks downstream capabilities.

**Evidence is mandatory.** Every phase completion requires a timestamped evidence block in `state.md`. The MCP server's `advance_phase` tool rejects transitions without evidence (minimum 10 characters).

---

## Prerequisites

| Dependency | Install | Used by |
|------------|---------|---------|
| **gstack** | `cd gstack && ./setup` | `/review`, `/qa`, `/ship`, `/canary`, `/cso` |
| **matt-skills** | `cd matt-skills && ./scripts/link-skills.sh` | `/tdd`, `/to-prd`, `/to-issues` |
| **gh CLI** | `brew install gh` / `apt install gh` | GitHub Issues |
| **Bun** | `curl -fsSL https://bun.sh/install` | Build + test |

---

## Development

```bash
bun install        # install deps
bun build          # compile MCP server
bun test           # run all tests (14, <3s)
bun run dev        # run MCP server in dev mode
```

Tests cover:
- SKILL.md frontmatter and structural validation
- All 4 phases and 5 INCEPTION sub-phases presence
- Phase transition gates and evidence templates
- MCP server tool registration and JSON-RPC handling
- Phase advancement with/without evidence
- Decision logging and index updates

---

## Dependency Management (Git Submodules)

This project uses git submodules to manage dependencies on gstack, matt-skills, and aidlc-workflows.

### Current Submodules

| Submodule | URL | Locked Version |
|-----------|-----|----------------|
| **gstack** | https://github.com/garrytan/gstack.git | 61c9a20 (heads/main) |
| **matt-skills** | https://github.com/mattpocock/skills.git | b8be62f (heads/main) |
| **aidlc-workflows** | https://github.com/awslabs/aidlc-workflows.git | 7e913f2 (v0.1.8-32-g7e913f2) |

### Submodule Commands

```bash
# Clone repository with submodules
git clone --recursive <repo-url>

# Initialize and update submodules (if already cloned)
git submodule init
git submodule update

# Update all submodules to latest
git submodule update --remote

# Update specific submodule
git submodule update --remote gstack

# Check submodule status
git submodule status

# Commit submodule changes
git add gstack matt-skills aidlc-workflows
git commit -m "chore: update submodules"
```

### Why Submodules?

- **Version locking**: Each dependency is pinned to a specific commit for reproducibility
- **Unified management**: Single command to update all dependencies
- **Clear boundaries**: Separates omni-wf code from its dependencies
- **Traceability**: Easy to see which version of each dependency was used

---

## 中文文档

详细执行规范见 [omni-wf/SKILL.md](omni-wf/SKILL.md)（中文为主）。

- [执行约束与违规处理](omni-wf/SKILL.md#critical--执行约束)
- [阶段转换门](omni-wf/SKILL.md#阶段转换门通用规则适用于所有阶段转换)
- [Subagent 执行架构](omni-wf/SKILL.md#22-context-management--subagent-execution--长任务上下文隔离)
- [错误恢复策略](omni-wf/SKILL.md#错误恢复)

---

## License

MIT
