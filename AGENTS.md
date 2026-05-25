# Omni Workflow (omni-skills) - Agent Guide

Behavioral guidelines for AI agents working on the omni-skills project. This is a meta-project that unifies three external skill ecosystems into a single autonomous development workflow.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Project Overview

omni-skills is a **meta-project** that unifies three external skill ecosystems into a single autonomous development workflow:

- **gstack** (https://github.com/garrytan/gstack) — QA, review, ship, deployment, security audit skills
- **matt-skills** (https://github.com/mattpocock/skills) — TDD, PRD generation, issue splitting
- **aidlc-workflows** (https://github.com/awslabs/aidlc-workflows) — Construction workflow patterns

The project itself contains:
- **omni-wf/** — The orchestrator skill (SKILL.md + MCP server)
- **gstack/** — Git submodule (review, QA, ship skills)
- **matt-skills/** — Git submodule (TDD, PRD, issue splitting)
- **aidlc-workflows/** — Git submodule (construction patterns)

## 6. Core Philosophy

> **"The Orchestrator Runtime is the Agent Itself"**

omni-wf is not a code pipeline — it's a **prompt pipeline**. The runtime is the AI agent itself, which:
- Reads SKILL.md to understand the workflow
- Calls downstream skills (gstack, matt-skills) at appropriate phases
- Maintains state in `.omni-wf/state.md`
- Self-validates phase transitions based on evidence
- Delegates to subagents when context limits threaten

## 7. Submodule Structure

### Git Submodules

omni-skills uses git submodules to track external skill ecosystems:

```
omni-skills/
├── gstack/              # Submodule: https://github.com/garrytan/gstack.git
├── matt-skills/         # Submodule: https://github.com/mattpocock/skills.git
├── aidlc-workflows/     # Submodule: https://github.com/awslabs/aidlc-workflows.git
└── omni-wf/             # Native: The orchestrator skill
```

### Submodule Management Rules

**When working on omni-skills:**

1. **Always initialize submodules first**
   ```bash
   git submodule update --init --recursive
   ```

2. **Never commit submodule changes directly to omni-skills**
   - Submodule commits should be made in their respective repositories
   - omni-skills only tracks the submodule commit hash

3. **When updating submodules:**
   ```bash
   # Update a specific submodule
   cd gstack
   git pull origin main
   cd ..
   git add gstack
   git commit -m "chore: update gstack submodule to latest"
   ```

4. **When testing changes to submodules:**
   - Make changes in the submodule directory
   - Test locally
   - If changes are needed for omni-skills compatibility, submit PR to the upstream submodule repo
   - Once merged, update the submodule in omni-skills

### Submodule Integration Points

| Submodule | Used by omni-wf phase | Skills invoked |
|-----------|----------------------|----------------|
| gstack | INCEPTION (reviews), CONSTRUCTION (review/QA), TEST (audit), SHIP (deploy) | `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/review`, `/qa`, `/cso`, `/ship`, `/land-and-deploy`, `/canary` |
| matt-skills | INCEPTION (PRD), CONSTRUCTION (TDD, issue split) | `/to-prd`, `/to-issues`, `/tdd` |
| aidlc-workflows | CONSTRUCTION (construction patterns) | Construction phase patterns, NFR checks |

## 8. Project Structure

```
omni-skills/
├── omni-wf/                      # Native: The orchestrator skill
│   ├── omni-wf/
│   │   └── SKILL.md              # Main orchestrator prompt
│   ├── prd-audit/
│   │   └── SKILL.md              # PRD review entry point
│   ├── mcp-server/
│   │   ├── src/server.ts         # MCP server (20 tools)
│   │   └── dist/server.js        # Built output
│   ├── bin/
│   │   └── omni-wf-state         # Bash helper
│   ├── test/
│   │   ├── skill-validation.test.ts
│   │   └── mcp-server.test.ts
│   ├── docs/
│   │   └── workflow-guide.md
│   ├── README.md
│   ├── CHANGELOG.md
│   ├── VERSION
│   └── setup                     # Installation script
├── gstack/                       # Submodule: garrytan/gstack
├── matt-skills/                  # Submodule: mattpocock/skills
├── aidlc-workflows/              # Submodule: awslabs/aidlc-workflows
├── scripts/
│   ├── install-gstack.sh
│   └── install-matt-skills.sh
├── install.sh                    # Full installer
├── README.md
└── AGENTS.md                     # This file
```

## 9. Key Subsystems

### omni-wf Orchestrator (`/omni-wf/`)
**Purpose**: Workflow orchestration and state management
- **SKILL.md**: Prompt-based orchestrator (INCEPTION → CONSTRUCTION → TEST → SHIP)
- **MCP Server**: 20 tools for state management, phase advancement, evidence validation
- **prd-audit**: Alternative entry point for existing PRDs
- **Key Files**: `omni-wf/SKILL.md`, `mcp-server/src/server.ts`, `bin/omni-wf-state`

### gstack (`/gstack/`)
**Purpose**: QA, review, ship, deployment skills
- **Skills**: `/qa`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/cso`, `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`
- **Usage**: Called by omni-wf at specific phases
- **Key Files**: `qa/SKILL.md`, `review/SKILL.md`, `ship/SKILL.md`

### matt-skills (`/matt-skills/`)
**Purpose**: TDD, PRD generation, issue splitting
- **Skills**: `/tdd`, `/to-prd`, `/to-issues`
- **Usage**: Called by omni-wf for CONSTRUCTION phase
- **Key Files**: `tdd/SKILL.md`, `to-prd/SKILL.md`, `to-issues/SKILL.md`

### aidlc-workflows (`/aidlc-workflows/`)
**Purpose**: Construction workflow patterns
- **Usage**: Referenced in omni-wf CONSTRUCTION phase for construction patterns
- **Key Files**: Construction phase documentation

## 10. Development Workflow

### When modifying omni-wf native code:

1. **Edit SKILL.md or MCP server code**
2. **Run tests**: `cd omni-wf && bun test`
3. **Update VERSION** (if breaking change or new feature)
4. **Update CHANGELOG.md** with changes
5. **Commit**: `git add omni-wf/ && git commit -m "..."`

### When updating submodules:

1. **Navigate to submodule**: `cd gstack`
2. **Pull latest**: `git pull origin main`
3. **Test locally**: Ensure omni-wf still works with updated submodule
4. **Update submodule reference**: `cd .. && git add gstack`
5. **Commit**: `git commit -m "chore: update gstack submodule to <commit-hash>"`

### When adding new features to omni-wf:

1. **Design the change** — Consider impact on downstream skills
2. **Update SKILL.md** — Add new phases or modify existing ones
3. **Update MCP server** — Add new tools if needed
4. **Add tests** — Update `test/skill-validation.test.ts` and `test/mcp-server.test.ts`
5. **Update documentation** — `docs/workflow-guide.md`, `README.md`
6. **Bump VERSION** — Follow semantic versioning
7. **Update CHANGELOG.md** — Document changes

## 11. Verification Steps

### Before committing changes:

1. **Run tests**: `cd omni-wf && bun test`
   - All 24 tests must pass (17 skill validation + 7 MCP integration)
   - If tests fail, fix before committing

2. **Check SKILL.md structure**:
   - Valid frontmatter
   - All 4 main phases defined
   - All 5 INCEPTION sub-phases defined
   - Phase transition gates present
   - state.md template present

3. **Build MCP server** (if modified):
   ```bash
   cd omni-wf
   bun install
   bun build
   ```

4. **Test installation**:
   ```bash
   cd omni-skills
   ./install.sh
   ```

### After committing changes:

1. **Push to feature branch**: `git push -u origin feat/your-branch`
2. **Create PR**: `gh pr create --title "..." --body "..."`
3. **Verify CI** (if configured): Ensure all checks pass

## 12. Git Workflow

### Branch Naming

- Feature branches: `feat/description`
- Bugfix branches: `fix/description`
- Chore branches: `chore/description`

### Commit Messages

Follow conventional commits:
- `feat: add new feature`
- `fix: fix bug`
- `chore: update submodule`
- `docs: update documentation`

### Submodule Commits

When updating submodules, include the commit hash in the message:
```
chore: update gstack submodule to 920a13a
```

## 13. Key Design Principles

1. **Orchestrator Runtime is the Agent** — omni-wf is a prompt pipeline, not code
2. **Evidence-Gated Transitions** — Phase transitions require verifiable evidence in state.md
3. **Subagent Isolation** — Large tasks delegate to subagents to keep orchestrator context clean
4. **Constraint Reinjection** — Each Issue begins with CRITICAL constraints re-injected (2.2.8)
5. **Context Reset** — Each Issue ends with context compression (2.2.7)
6. **Submodule Independence** — Changes to submodules go upstream, not into omni-skills

## 14. Navigation Guide

For specific tasks, refer to:
- **Workflow architecture**: `omni-wf/omni-wf/SKILL.md`
- **MCP tools**: `omni-wf/mcp-server/src/server.ts`
- **User guide**: `omni-wf/USAGE.md`
- **Installation**: `install.sh` or `scripts/install-*.sh`
- **Submodule skills**: Navigate to respective submodule directories
- **Testing**: `omni-wf/test/`

## 15. Common Tasks

### Adding a new phase to omni-wf:

1. Edit `omni-wf/omni-wf/SKILL.md` — Add phase definition
2. Update `omni-wf/mcp-server/src/server.ts` — Add phase validation if needed
3. Update `omni-wf/test/skill-validation.test.ts` — Add phase check
4. Update `omni-wf/CHANGELOG.md` — Document change
5. Bump `omni-wf/VERSION`

### Adding a new MCP tool:

1. Edit `omni-wf/mcp-server/src/server.ts` — Add tool handler
2. Update `omni-wf/test/mcp-server.test.ts` — Add integration test
3. Update `omni-wf/CHANGELOG.md` — Document change
4. Bump `omni-wf/VERSION`

### Updating a submodule:

1. Navigate to submodule: `cd gstack`
2. Pull latest: `git pull origin main`
3. Test locally: Ensure omni-wf still works
4. Update reference: `cd .. && git add gstack`
5. Commit: `git commit -m "chore: update gstack submodule to <hash>"`

## 16. Troubleshooting

### Submodule not initialized:

```bash
git submodule update --init --recursive
```

### Tests failing:

1. Check SKILL.md structure
2. Check MCP server code
3. Ensure submodules are at correct commits
4. Run `bun test` in `omni-wf/` directory

### Installation failing:

1. Check submodules are initialized
2. Check gstack/matt-skills are installed
3. Check installation scripts have execute permissions
4. Run with bash explicitly: `bash install.sh`

---

**Remember:** omni-skills is a meta-project. Most changes should be in omni-wf native code. Submodule changes go upstream.
