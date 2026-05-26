---
name: omni-wf
description: |
  Omni Workflow — 通用自主开发工作流编排器。
  将 INCEPTION → CONSTRUCTION → TEST → SHIP 串联为一条自动化管道。
  对齐 gstack / matt-skills / aidlc-workflows 三大体系，自动检测变更范围，
  路由到合适的评审技能，驱动全流程开发。严禁跳过任何阶段或步骤。
triggers:
  - omni-wf
  - omni workflow
  - start workflow
  - 开始工作流
  - 自主开发
---

# Omni Workflow — 自主开发工作流

## CRITICAL — 执行约束（违反 = 自动修正并记录，无例外）

**本工作流的所有阶段和子阶段都是强制的。严禁跳过、简化或主观修改。**
发现违规时优先自动修正（回退到正确阶段、补齐遗漏产出物），将修正记录到 state.md，仅当无法自修正时才暂停向用户报告。

### 禁止行为

| 禁止项 | 说明 | 违规处理 |
|--------|------|---------|
| 跳过阶段 | 不得以任何理由跳过 INCEPTION / CONSTRUCTION / TEST / SHIP | 自动回退到被跳过的阶段起点，补齐遗漏产出物 |
| 跳过子阶段 | 不得跳过 INCEPTION 中的 office-hours / ceo-review / eng-review / design-review / prd-finalization | 自动回退到被跳过的子阶段，完整执行后记录证据 |
| 提前进入下一阶段 | 当前阶段未提供可验证的完成证据前，不得进入下一阶段 | 自动回退到当前阶段，补齐证据后重新自验证 |
| 替换 skill 调用 | 不得以其他操作替代文档中明确要求的 `/skill-name` | 记录替换行为，尝试重新调用正确 skill，记录结果 |
| 主观判断替代规则 | 不得以"学习项目"、"足够简单"等理由覆盖路由规则 | 记录判断依据，按文档规则重新执行，记录偏差 |
| 省略证据记录 | 每个子阶段完成后必须记录产出物，不得省略 | 回退到该子阶段重新执行并记录产出物 |

### 强制要求

| 要求 | 说明 |
|------|------|
| 完整执行 | 每个子阶段必须执行文档中列出的**所有**步骤 |
| 产出物落盘 | 每个子阶段必须有明确的产出物（文档/记录/编号） |
| 证据记录 | 每个阶段完成后必须在 state.md 中记录可验证的完成证据 |
| 自验证推进 | 阶段转换由 Agent 自验证通过自动推进，无需人工确认 |
| 违规即录 | 发现偏差先记录到 state.md，优先自动修正，仅严重阻塞时暂停 |
| 条件即执行 | 文档中标注"若 XXX，必须 XXX"的条件，一旦触发必须执行 |

### 违规处理协议

```
发现违规 → 记录到 state.md Notes（违规行为、涉及阶段、影响）
         → 优先自动修正（回退到正确阶段、补齐遗漏产出物）
         → 仅当无法自修正时，才暂停并向用户报告
         → 修正后继续工作流，不得跳过或简化
```

---

## 核心理念

Omni Workflow 的运行时就是 AI 代理本身。工作流是**提示词管道**，不是代码管道。

本技能不替代 gstack、matt-skills 或 aidlc-workflows 的单个技能，而是**编排器**：
- 按阶段调用专业技能完成具体工作
- 每个阶段有明确的产出物要求
- 状态落盘到项目文档目录，支持断点续作
- 借鉴 gstack 的测试交付规范：每个产出物必须经过验证

### 与三大体系的映射

| omni-wf | gstack | matt-skills | aidlc-workflows |
|---------|--------|-------------|-----------------|
| INCEPTION | `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review` | `/to-prd` (PRD 最终化) | inception |
| CONSTRUCTION | `/tdd` + `/review` + `/qa` | `/tdd` + `/to-issues` | construction |
| TEST | `/qa` + `/design-review` + `/cso` + `/investigate` | — | construction (nfr) |
| SHIP | `/review` + `/benchmark` + `/ship` + `/land-and-deploy` + `/canary` | — | operations |

---

## 项目目录规范

```
/your-project/
├── docs/
│   ├── prds/                 # PRD 目录（INCEPTION 阶段产出）
│   │   └── 001-auth-system.md
│   ├── decisions/            # 决策日志（INCEPTION 各子阶段产出）
│   │   ├── README.md         # 决策索引表（AI 自动维护）
│   │   ├── DECISION-001-office-hours-use-jwt.md
│   │   ├── DECISION-002-eng-review-use-postgres.md
│   │   └── DECISION-003-design-review-dark-mode.md
│   ├── adr/                  # ADR 目录（matt-skills 惯例）
│   │   └── ADR-001-cache-strategy.md
│   └── specs/                # 技术规格（Eng Review 产出）
│       └── SPEC-001-oauth-db-design.md
│
├── .omni-wf/
│   ├── state.md              # 工作流状态（阶段/进度/证据）
│   └── reviews/              # 逐 Issue review/QA 记录（CONSTRUCTION 产出）
│       └── issue-001.md
│
└── GitHub Issues             # Issue 垂直切片（CONSTRUCTION 阶段产出，omni-wf label）
```

### 命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| PRD | `NNN-{short-title}.md` | `001-auth-system.md` |
| Decision | `DECISION-NNN-{source}-{short-title}.md` | `DECISION-001-office-hours-use-jwt.md` |
| ADR | `ADR-NNN-{short-title}.md` | `ADR-001-cache-strategy.md` |
| Spec | `SPEC-NNN-{short-title}.md` | `SPEC-001-oauth-db-design.md` |
| Review | `issue-NNN.md` | `issue-001.md` |

- `NNN`: 3 位零填充序号，递增
- `short-title`: 小写，kebab-case
- Decision 的 `source` 字段标明来源子阶段（office-hours / ceo-review / eng-review / design-review）

### 文档关联规则

- PRD 文件头部 `## Source` 记录关联的决策列表
- Decision 文件头部 `## Related PRD` 记录关联的 PRD
- Decision 文件头部 `## Source Phase` 标明来源子阶段
- GitHub Issue body `## Parent PRD` 引用本地 PRD 路径
- GitHub Issue body `## Related Decisions` 引用本地决策路径
- Review 文件头部 `## Issue` 引用 GitHub Issue 编号

---

## 前置依赖

**本技能运行前必须已安装以下依赖。若未安装，提示用户安装后重新启动。不得在未安装的情况下继续。**

| 依赖 | 检查路径 | 用途 |
|------|---------|------|
| **gstack** | `~/.claude/skills/gstack/` 或 `~/.agents/skills/gstack/` | 评审、QA、发布、部署、安全审计 |
| **matt-skills** | `~/.claude/skills/tdd` 或 `~/.agents/skills/tdd` | TDD、PRD 生成、Issue 拆分 |
| **gh CLI** | `gh --version` | GitHub Issue 创建与管理 |

---

## Preamble (run first)

```bash
# --- 状态探测 ---
_OMNI_DIR=".omni-wf"
_STATE_FILE="$_OMNI_DIR/state.md"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

mkdir -p "$_OMNI_DIR" "$_OMNI_DIR/reviews"
mkdir -p "docs/prds" "docs/decisions" "docs/adr" "docs/specs"

if [ -f "$_STATE_FILE" ]; then
  echo "STATE_FOUND: yes"
  _PHASE=$(grep "^## Current Phase:" "$_STATE_FILE" | sed 's/.*: *//' | tr -d ' \r')
  _STAGE=$(grep "^## Current Stage:" "$_STATE_FILE" | sed 's/.*: *//' | tr -d ' \r')
  echo "CURRENT_PHASE: $_PHASE"
  echo "CURRENT_STAGE: $_STAGE"
else
  echo "STATE_FOUND: no"
  echo "CURRENT_PHASE: IDLE"
  echo "CURRENT_STAGE: none"
fi

echo "BRANCH: $_BRANCH"
echo "REPO_ROOT: $_ROOT"

# --- 流程完整性检查 ---
if [ -f "$_STATE_FILE" ]; then
  _COMPLETED=$(grep "^## Completed Phases:" "$_STATE_FILE" -A 10 | grep "\[x\]" | awk '{print $2}' | tr '\n' ' ')
  echo "COMPLETED_PHASES: $_COMPLETED"

  _FOUND_SKIP="no"
  for phase in INCEPTION CONSTRUCTION TEST SHIP; do
    if echo "$_COMPLETED" | grep -q "$phase"; then
      _FOUND_PHASE="yes"
    else
      _FOUND_PHASE="no"
    fi
    if [ "$_FOUND_PHASE" = "no" ] && [ -n "$_PREV_FOUND" ] && [ "$_PREV_FOUND" = "yes" ]; then
      _FOUND_SKIP="yes"
      echo "SKIP_DETECTED: $phase (previous phase completed but this one missing)"
    fi
    _PREV_FOUND="$_FOUND_PHASE"
  done
  echo "PHASE_SKIP_DETECTED: $_FOUND_SKIP"
fi

# --- 范围检测 ---
if git rev-parse --git-dir >/dev/null 2>&1; then
  _DIFF_STAT=$(git diff --stat HEAD 2>/dev/null | tail -1)
  _FILE_COUNT=$(echo "$_DIFF_STAT" | grep -o '[0-9]* file' | grep -o '[0-9]*' || echo "0")
  _HAS_FRONTEND=$(git diff --name-only HEAD 2>/dev/null | grep -cE '\.(tsx|jsx|css|vue|svelte|html)$' || echo "0")
  _HAS_SECURITY=$(git diff --name-only HEAD 2>/dev/null | grep -ciE '(auth|oauth|jwt|secret|token|password|crypto)' || echo "0")
  _HAS_API=$(git diff --name-only HEAD 2>/dev/null | grep -ciE '(route|api|endpoint|graphql|grpc)' || echo "0")
  _HAS_DB=$(git diff --name-only HEAD 2>/dev/null | grep -ciE '(schema|migration|sql|model|prisma|sequelize)' || echo "0")

  echo "CHANGED_FILES: $_FILE_COUNT"
  echo "HAS_FRONTEND: $_HAS_FRONTEND"
  echo "HAS_SECURITY: $_HAS_SECURITY"
  echo "HAS_API: $_HAS_API"
  echo "HAS_DB: $_HAS_DB"
else
  echo "CHANGED_FILES: N/A (not a git repo)"
  echo "HAS_FRONTEND: 0"
  echo "HAS_SECURITY: 0"
  echo "HAS_API: 0"
  echo "HAS_DB: 0"
fi

# --- 依赖检查 ---
_GSTACK_OK=$([ -d ~/.claude/skills/gstack ] || [ -d ~/.agents/skills/gstack ] && echo "yes" || echo "no")
_MATT_OK=$([ -d ~/.claude/skills/tdd ] || [ -d ~/.agents/skills/tdd ] && echo "yes" || echo "no")
_GH_OK=$(command -v gh >/dev/null 2>&1 && echo "yes" || echo "no")
echo "GSTACK_INSTALLED: $_GSTACK_OK"
echo "MATT_INSTALLED: $_MATT_OK"
echo "GH_INSTALLED: $_GH_OK"

# --- 决策索引更新 ---
if [ -f "docs/decisions/README.md" ]; then
  _DECISION_COUNT=$(ls -1 docs/decisions/DECISION-*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "DECISION_INDEX: $_DECISION_COUNT entries"
else
  echo "DECISION_INDEX: 0 (no README)"
fi

# --- worktree 探测 ---
_WORKTREE_BASE="$HOME/.worktrees"
if [ -n "$_ROOT" ] && [ "$_ROOT" != "." ]; then
  _REPO_NAME=$(basename "$_ROOT")
  _SAFE_BRANCH=$(echo "$_BRANCH" | tr '/' '-')
  _WORKTREE_PATH="$_WORKTREE_BASE/$_REPO_NAME/$_SAFE_BRANCH"
  if [ -d "$_WORKTREE_PATH" ]; then
    echo "WORKTREE_PATH: $_WORKTREE_PATH"
    echo "WORKTREE_STATUS: exists"
  else
    echo "WORKTREE_PATH: $_WORKTREE_PATH"
    echo "WORKTREE_STATUS: not_created"
  fi
else
  echo "WORKTREE_PATH: N/A"
  echo "WORKTREE_STATUS: not_a_git_repo"
fi
```

---

## 阶段总览

```
INCEPTION (需求明确 + 架构锁定)
  ├── 1.1 Office Hours      → /office-hours      → 产出: 需求验证 + 决策
  ├── 1.2 CEO Review      → /plan-ceo-review   → 产出: 战略决策
  ├── 1.3 Eng Review      → /plan-eng-review   → 产出: 架构决策 + 数据流图 + 测试策略
  ├── 1.4 Design Review     → /plan-design-review → 产出: 设计决策 (条件: HAS_FRONTEND>0)
  └── 1.5 PRD Finalization  → /to-prd            → 产出: docs/prds/NNN-xxx.md

CONSTRUCTION (垂直切片编码)
  ├── 2.1 Issue Split       → /to-issues         → 产出: GitHub Issues (omni-wf label)
  ├── 2.2 Context Mgmt      → run_subagent       → 产出: 隔离上下文 + 干净执行
  ├── 2.3 Per-Issue TDD     → /tdd               → 产出: 代码 + 测试 (引入 aidlc construction 规范)
  ├── 2.4 Per-Issue Review  → /review            → 产出: .omni-wf/reviews/issue-NNN.md
  ├── 2.5 Per-Issue QA      → /qa                → 产出: QA 报告 (条件: 前端 Issue)
  └── 2.6 Per-Issue Test    → npm test           → 产出: 测试通过记录

TEST (系统集成验证)
  ├── 3.1 Integration Tests
  ├── 3.2 Browser Validation (条件: HAS_FRONTEND>0)
  ├── 3.3 Design Audit    (条件: HAS_FRONTEND>0)
  ├── 3.4 Security Audit  (条件: HAS_SECURITY>0)
  └── 3.5 Bug Investigation (条件: 发现 Bug)

SHIP (发布部署)
  ├── 4.1 Pre-merge Review
  ├── 4.2 Performance Baseline (条件: HAS_FRONTEND>0)
  ├── 4.3 Release         → /ship
  ├── 4.4 Deploy          → /land-and-deploy
  └── 4.5 Canary          → /canary
```

---

## Phase 0: 入口与状态恢复

1. **读取 `.omni-wf/state.md`**（如果存在）。提取 `Current Phase`、`Current Stage`、`Phase Completion Evidence`。
2. **检查 `PHASE_SKIP_DETECTED`**：
   - 若 `yes`：自动回退到被跳过的阶段起点，在 state.md 记录回退原因
   - 从回退点继续完整执行，补齐所有遗漏产出物
3. **若 `Current Phase` 不是 `IDLE`**：
   - 自动恢复当前状态，展示状态摘要 + 已完成阶段 + 待完成阶段
   - 从 `Current Stage` 自动继续执行
4. **若用户明确要求重新开始**：重置 `state.md` 为 IDLE，清空所有 `pending` 和 `evidence`。
5. **若用户通过 `/prd-audit` 入口触发**：
   - 说明：用户已有 PRD，希望跳过完整 INCEPTION 评审，快速进入构建
   - 处理：当前技能（omni-wf）不直接处理 `/prd-audit`，将控制权交给 `prd-audit` skill
   - `prd-audit` 完成审查和 Issue 拆分后，会初始化 state.md 并标记 INCEPTION 完成，然后回到 omni-wf 的 CONSTRUCTION 阶段
   - 从 CONSTRUCTION 开始，所有后续规则、产出物、阶段转换门**完全继承本文档规范**

### state.md 初始化模板

```markdown
# Omni Workflow State

## Current Phase: IDLE
## Current Stage: none
## Branch: $_BRANCH
## Worktree Path: [由 /setup-worktree 创建后填充]
## Started At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
## Last Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Completed Phases
- [ ] INCEPTION
- [ ] CONSTRUCTION
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence

### INCEPTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Sub-phases completed: [待记录]
- User Confirmation: [待确认]

### CONSTRUCTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Issues completed: [N / total N]
- Per-Issue Review Status: [待记录]
- Worktree Path: [~/.worktrees/{repo}/{branch}]
- User Confirmation: [待确认]

### TEST Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

### SHIP Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

## Pending Decisions
None

## PRDs
None

## GitHub Issues
None

## Notes
```

Agent 自验证通过后自动继续执行。

---

## 阶段转换门（通用规则，适用于所有阶段转换）

**任何阶段转换前，Agent 必须执行以下检查。缺少任何一项 = 禁止转换。**

### 强制验证清单

```
□ 当前阶段的所有子阶段已完整执行
□ 每个子阶段都有可验证的产出物（文档/记录/编号）
□ state.md 中当前阶段的 Phase Completion Evidence 已记录
□ 文档要求的 skill 调用已全部执行（无遗漏）
□ 当前阶段无 Pending Decision 未解决
```

### 阶段转换协议

```
1. Agent 自验证：对照文档检查当前阶段完成度
2. 若发现遗漏：记录到 state.md，自动回退到遗漏点补齐
3. 若全部完成：记录完成摘要 + 产出物列表 + 证据记录到 state.md
4. 自动推进：更新 state.md（标记当前阶段完成，记录证据，设置下一阶段）
5. 进入下一阶段，继续执行
```

**严禁**：未经自验证擅自进入下一阶段。

---

## Phase 1: INCEPTION — 需求明确与架构锁定

**目标**：在写任何代码之前，通过多轮评审明确需求、锁定架构、产出可执行的 PRD。

**强制要求**：INCEPTION 的所有 5 个子阶段必须按顺序完整执行。每个子阶段都有明确的产出物要求。**不得跳过任何子阶段。**

---

### 1.1 Office Hours — 需求验证

**目标**：验证"需求是否真实存在"、"用户是谁"、"他们现在怎么解决这个问题的"。

**调用技能**：`/office-hours`

**执行规则**：
- 运行 `/office-hours`（gstack）
- 跟随 skill 的 Phase 1-2 流程（Context Gathering + Startup/Builder Mode）
- 回答六种 forcing questions，直到产出明确的需求结论
- 不得因为"看起来简单"而跳过任何 forcing question

**产出物要求**：

1. **决策落盘**：`docs/decisions/DECISION-NNN-office-hours-{short-title}.md`

```markdown
# Decision: DECISION-NNN-office-hours-{short-title}

## Phase: INCEPTION
## Sub-phase: office-hours
## Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
## Status: PENDING

## Context
[office-hours 中的关键发现]

## Decision
[基于需求验证的决策]

## Consequences
[正面和负面影响]
```

2. **更新决策索引**：更新 `docs/decisions/README.md`

自动记录 office-hours 结论到 state.md，继续执行 CEO Review。

---

### 1.2 CEO Review — 战略评审

**目标**：从 CEO/创始人视角审视产品方向，确保解决的是正确的问题。

**调用技能**：`/plan-ceo-review`

**执行规则**：
- 运行 `/plan-ceo-review`（gstack）
- 跟随 skill 的 Scope Challenge + Review Sections 流程
- 产出战略层面的决策（目标用户、核心价值、竞争定位）

**产出物要求**：

1. **决策落盘**：`docs/decisions/DECISION-NNN-ceo-review-{short-title}.md`
2. **更新决策索引**

自动记录 CEO Review 结论到 state.md，继续执行 Eng Review。

---

### 1.3 Eng Review — 架构评审

**目标**：锁定技术架构、数据流、接口设计、测试策略。

**调用技能**：`/plan-eng-review`

**执行规则**：
- 运行 `/plan-eng-review`（gstack）
- 跟随 skill 的 Step 0（Scope Challenge）+ Review Sections（Architecture → Code Quality → Tests → Performance）
- 产出架构层面的决策

**产出物要求**：

1. **架构决策**：`docs/decisions/DECISION-NNN-eng-review-{short-title}.md`
2. **技术规格**：`docs/specs/SPEC-NNN-{short-title}.md`（Eng Review 中产生的技术方案）

```markdown
# SPEC-NNN-{short-title}

## Source
- Eng Review: [关联的决策编号]
- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Architecture Overview
[架构概述]

## Data Flow
[数据流描述或 mermaid 图]

## Interface Design
[接口定义]

## Test Strategy
[测试策略]

## NFR Considerations
[非功能性需求]
```

3. **更新决策索引**

自动记录 Eng Review 结论到 state.md，继续执行 Design Review。

---

### 1.4 Design Review — 设计评审（条件：HAS_FRONTEND > 0 时必须执行）

**目标**：评审 UI/UX 设计，确保可用性和一致性。

**调用技能**：`/plan-design-review`

**执行规则**：
- **若 `HAS_FRONTEND > 0`：必须执行**
- 运行 `/plan-design-review`（gstack）
- 跟随 skill 的 Review Sections 流程
- 产出设计层面的决策

**产出物要求**：

1. **设计决策**：`docs/decisions/DECISION-NNN-design-review-{short-title}.md`
2. **更新决策索引**

**若 `HAS_FRONTEND = 0`：**
- 记录 "Design Review skipped: no frontend changes detected"
- 仍需记录到 state.md 的 INCEPTION Evidence 中

自动记录 Design Review 结论到 state.md，继续执行 PRD Finalization。

---

### 1.5 PRD Finalization — PRD 生成

**目标**：将 INCEPTION 的所有评审产出整合为一份可执行的 PRD。

**调用技能**：`/to-prd`

**执行规则**：
- 运行 matt-skills 的 `/to-prd`
- 以 INCEPTION 所有子阶段的产出为输入（决策、技术规格、设计决策）
- 整合为完整 PRD

**产出物要求**：

1. **PRD 文件**：`docs/prds/NNN-{short-title}.md`

```markdown
# NNN-{short-title}

## Source
- Branch: $_BRANCH
- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Related Decisions
- docs/decisions/DECISION-NNN-office-hours-xxx.md
- docs/decisions/DECISION-NNN-ceo-review-xxx.md
- docs/decisions/DECISION-NNN-eng-review-xxx.md
- docs/decisions/DECISION-NNN-design-review-xxx.md

## Related Specs
- docs/specs/SPEC-NNN-xxx.md

## Problem Statement
...

## Solution
...

## User Stories
...

## Implementation Decisions
...

## Testing Decisions
...

## Out of Scope
...
```

2. **更新 state.md**：PRDs 列表追加

自动记录 PRD 摘要到 state.md，标记 INCEPTION 完成，进入 CONSTRUCTION。

---

### INCEPTION 阶段转换门

```
□ Office Hours 已完成，决策已落盘
□ CEO Review 已完成，战略决策已落盘
□ Eng Review 已完成，架构决策 + 技术规格已落盘
□ Design Review 已完成或已记录跳过原因（若 HAS_FRONTEND=0）
□ PRD Finalization 已完成，PRD 已保存到 docs/prds/
□ 所有决策已记录到 docs/decisions/ 且索引表已更新
□ state.md 中 INCEPTION Phase Evidence 已记录
```

---

## Phase 2: CONSTRUCTION — 垂直切片编码

**目标**：按依赖顺序，对每个垂直切片执行 TDD 开发 + 代码审查 + QA + 测试。

**强制要求**：CONSTRUCTION 的所有子阶段必须按顺序执行。每个 Issue 完成后必须经过完整的 review/QA/test 流程方可关闭。

---

### 2.1 Issue Split — 垂直切片拆分

**目标**：将 PRD 拆分为可独立抓取、可追踪的垂直切片 Issue。

**调用技能**：`/to-issues`

**执行规则**：

> **入口检查点**：CONSTRUCTION 阶段开始时（或断点恢复后），必须先执行 **2.2.8 Constraint Reinjection Protocol**，确认当前处于 CONSTRUCTION Phase，严禁跳过任何前置阶段。

- **首先调用 `/setup-worktree`**：确保当前分支的 worktree 已创建于 `~/.worktrees/{repo-name}/{branch-name}/`，将路径记录到 state.md
- 运行 matt-skills 的 `/to-issues`
- 以 PRD 为输入
- 获取垂直切片列表

**产出物要求**：

1. **GitHub Issues**：通过 `gh issue create` 发布每个切片

```bash
gh issue create \
  --title "[Slice-N] {标题}" \
  --body "$(cat <<'EOF'
## Parent PRD
docs/prds/NNN-{title}.md

## Type
[HITL | AFK]

## What to build
[垂直切片描述 — 端到端行为，非分层实现]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Blocked by
[GitHub Issue #XXX | None]

## Related Decisions
- docs/decisions/DECISION-NNN-xxx.md

## Worktree Path
~/.worktrees/{repo-name}/{branch-name}

## Status
OPEN
EOF
)" \
  --label "omni-wf"
```

2. **记录 Issue 编号**：保存到 state.md

自动记录 Issue 列表到 state.md，继续执行 TDD 编码。

---

### 2.2 Context Management & Subagent Execution — 长任务上下文隔离

**目标**：当 CONSTRUCTION 阶段任务量巨大、上下文接近限额时，将单个 Issue 的完整 TDD+Review+Test 循环委托给 subagent，保持主 agent（Orchestrator）上下文干净。

**为什么需要**：
- 巨大长任务的完整 CONSTRUCTION 阶段可能涉及数十个 Issue、数千行变更
- 主 agent 若累积全部 TDD 讨论、review 细节、测试输出，极易超出 context 限额
- subagent 在隔离上下文中执行单一 Issue，完成后只向主 agent 回传**结果摘要**

**补充机制**：subagent 隔离了单个 Issue 的执行噪音，但主 agent 仍然会在处理多个 Issue 后累积状态摘要。因此，**2.2.7 Per-Issue Context Reset Protocol** 和 **2.2.8 Constraint Reinjection Protocol** 是必须执行的——即使使用 subagent，每个 Issue 完成后主 agent 也必须主动压缩上下文并重注阶段约束。

**worktree 隔离**：在委托 subagent 前，调用 `/setup-worktree` 确保当前分支的 worktree 已创建于 `~/.worktrees/` 下。subagent 在 worktree 中执行代码变更，实现物理文件系统隔离。每个 Issue 的最小上下文包中必须包含 `worktree_path`。

---

#### 2.2.1 执行模式选择

主 agent 根据以下规则决定直接执行或委托 subagent：

| 条件 | 模式 | 说明 |
|------|------|------|
| Issue 涉及文件 < 20 个，预估变更 < 500 行，上下文充裕 | **直接执行** | 主 agent 在现有上下文中完成 TDD + 验证 |
| Issue 涉及文件 >= 20 个，或预估变更 >= 500 行，或上下文 > 70% | **subagent 委托** | 将当前 Issue 的 TDD 委托给 subagent，验证由主 agent 或验证 subagent 执行 |
| 验证时上下文 > 70%（subagent 产出已占大量 context） | **验证 subagent 委托** | 将回归测试 + /review + /qa 委托给独立验证 subagent |
| 多个 Issue 无互相依赖 | **并行 subagent** | 同时启动多个 subagent |
| 用户明确要求 | **subagent 委托** | 优先使用 subagent |

---

#### 2.2.2 上下文边界协议

```
┌─────────────────────────────┐      ┌─────────────────────────────┐
│     主 agent (Orchestrator)  │      │   subagent (Issue Executor)  │
├─────────────────────────────┤      ├─────────────────────────────┤
│ 维护完整 state.md           │◄────►│ 只接收"最小上下文包"        │
│ 编排 Issue 执行顺序         │      │ 独立执行 TDD + Review + Test │
│ 验证 subagent 产出          │      │ 不访问其他 Issue / PRD      │
│ 更新全局状态                │◄────►│ 产出回传后由主 agent 验证   │
│ 决策冲突时裁决              │      │ 不保留跨 Issue 的记忆        │
└─────────────────────────────┘      └─────────────────────────────┘
```

**主 agent 绝不向 subagent 传递**：
- 完整 state.md（只传递当前 Issue 相关的片段）
- 其他 Issue 的详细内容
- 上游阶段（INCEPTION）的完整讨论记录
- 与工作流编排无关的全局上下文

---

#### 2.2.3 最小上下文包（Context Package）

主 agent 为每个 subagent 构建一个干净的上下文包：

```json
{
  "issue_id": "NNN",
  "issue_title": "User authentication with JWT",
  "acceptance_criteria": [
    "User can login with email/password",
    "JWT token is issued on successful auth",
    "Token expires after 24h"
  ],
  "relevant_files": [
    "src/auth/service.ts",
    "src/auth/routes.ts",
    "tests/auth.test.ts"
  ],
  "related_decisions": [
    "DECISION-003-use-jwt",
    "DECISION-005-bcrypt-for-password"
  ],
  "project_root": "/path/to/repo",
  "worktree_path": "/home/user/.worktrees/repo-name/feat-auth-system",
  "test_command": "bun test",
  "constraints": [
    "use_existing_patterns",
    "no_hardcode_secrets",
    "follow_aidlc_construction_rules"
  ],
  "current_branch": "feat/omni-wf-mvp"
}
```

**`worktree_path` 说明**：
- 由 `/setup-worktree` 创建，统一在 `~/.worktrees/{repo-name}/{branch-name}/`
- subagent 必须在此路径下执行所有代码变更，不得在主 repo 目录直接修改
- 上下文重置或会话恢复后，agent 通过 state.md 中记录的 `worktree_path` 重新定位工作区
- 验证 subagent 同样需要在 `worktree_path` 中运行测试和 review

---

#### 2.2.4 subagent 执行流程

```
1. 主 agent 评估当前 Issue 规模和上下文余量
2. 若需 subagent：构建最小上下文包
3. **调用 `/setup-worktree` 确保 worktree 就绪**
   - 若 state.md 中已有当前分支的 `worktree_path`，复用该路径
   - 若不存在，调用 `/setup-worktree` 创建，并将返回的 `WORKTREE_PATH` 记录到 state.md
   - 将 `worktree_path` 注入最小上下文包
4. 调用 run_subagent（profile: subagent_general）
   └── subagent 接收上下文包（含 worktree_path），在隔离环境中执行：
       a. 进入 worktree_path 目录
       b. TDD 循环（RED → GREEN → Refactor）
       c. Self-Review（按 2.4 Review 检查表自检）
       d. 运行项目测试
       e. 整理产出物摘要
4. subagent 返回结构化结果：
   {
     "files_changed": [...],
     "test_results": { "passed": N, "failed": 0 },
     "self_review": { "status": "PASS", "findings": [...] },
     "evidence_summary": "实现 JWT auth，3 个测试通过，自检无问题"
   }
5. **主 agent 验证**（两种模式，根据上下文余量选择）：

   **模式 A：直接验证**（主 agent 上下文 < 70% 时）
   - a. 检出 subagent 修改的文件
   - b. 运行项目测试确认无回归
   - c. 检查产出物是否满足验收标准
   - d. 补充执行 `/review`（gstack 正式 review）
   - e. 若涉及前端变更，执行 `/qa`

   **模式 B：验证 subagent 委托**（主 agent 上下文 >= 70% 时）
   - a. 主 agent 构建**验证上下文包**：
     ```json
     {
       "issue_id": "NNN",
       "files_changed": ["src/auth/service.ts", "tests/auth.test.ts"],
       "acceptance_criteria": [...],
       "test_command": "bun test",
       "needs_review": true,
       "needs_qa": false,
       "project_root": "/path/to/repo",
       "worktree_path": "/home/user/.worktrees/repo-name/feat-auth-system"
     }
     ```
   - b. 调用 run_subagent（profile: subagent_general）执行验证：
     - 运行项目测试 suite，收集结果摘要
     - 执行 `/review`，提取关键发现（非完整输出）
     - 若需要，执行 `/qa`，提取关键 bug 列表
   - c. 验证 subagent 返回结构化结果：
     ```json
     {
       "tests": { "status": "PASS", "total": 45, "failed": 0, "new_tests": 3 },
       "review": { "status": "PASS", "critical_findings": [], "warnings": ["建议提取重复代码"] },
       "qa": { "status": "N/A" },
       "regression_check": "无回归",
       "acceptance_verdict": "满足全部验收标准",
       "recommendation": "接受"
     }
     ```
   - d. 主 agent 只接收结构化摘要，做最终裁决（接受 / 打回 / 补充验证）

6. 验证通过 → 更新 state.md，关闭 Issue
   验证不通过 → 打回 subagent 并附带修正指令
```

---

#### 2.2.5 subagent 失败处理

| 场景 | 处理策略 |
|------|---------|
| subagent 执行失败（crash / timeout） | 主 agent 记录原因，重试一次（带修正上下文），仍失败则接管手动执行 |
| subagent 产出不满足验收标准 | 主 agent 分析偏差，生成具体修正指令，重新委托或手动修复 |
| subagent 修改导致项目测试失败 | 主 agent 运行 `/investigate` 定位问题，打回 subagent 或自行修复 |
| subagent 上下文超限 | 拆分为更细粒度的子任务（子-Issue），分别委托 |
| 验证 subagent 测试失败 | 主 agent 分析失败原因，若可自动修复则委托修正 subagent，否则打回原始 subagent |
| 验证 subagent review 发现关键问题 | 主 agent 提取关键发现，打回原始 subagent 并附带具体修正指令 |
| 验证 subagent 上下文超限 | 拆分验证任务（先测后 review），或降级为仅运行测试 |

---

#### 2.2.6 并行执行规则

- **无依赖的 Issue** 可以并行启动多个 subagent（推荐最多 3 个并发，避免 I/O 冲突）
- **有依赖的 Issue** 必须等前置 Issue 关闭后才能启动 subagent
- 主 agent 在 state.md 中维护执行队列：

```markdown
## Subagent Queue
- Running: #42 (auth), #43 (session)
- Pending: #44 (profile, blocked by #42)
- Completed: #41 (setup)
```

#### 2.2.7 Per-Issue Context Reset Protocol — 上下文重置协议（强制）

**目标**：每个 Issue 完成后主动压缩上下文，防止执行细节累积导致状态漂移。

**为什么必须**：
- 主 agent 在 CONSTRUCTION 阶段可能处理 10+ 个 Issue
- 每个 Issue 的 TDD 讨论、review 输出、测试日志、QA 截图都会占据上下文
- 不清理则 5-6 轮后，CRITICAL 约束和阶段目标被稀释，agent 开始主观简化流程

**执行时机**：每个 Issue 关闭后、下一个 Issue 开始前。

**重置步骤（必须按顺序执行）**：

```
1. 确认当前 Issue 的所有产出物已落盘：
   - .omni-wf/reviews/issue-NNN.md 已保存
   - state.md 已更新（Evidence / Issues completed / Subagent Queue）
   - GitHub Issue 已关闭（如有）

2. 执行上下文压缩：
   - 将当前 Issue 的详细执行记录（TDD 过程、review 原始输出、测试日志）标记为【已归档】
   - 只保留以下信息在活跃上下文中：
     * Issue 编号与标题
     * 验收结果（review/QA/tests 的 PASS/FAIL 状态）
     * 关键发现（若有）
   - 其余内容从当前工作上下文中【主动移除】

3. 验证压缩效果：
   - 确认 state.md 中的 CONSTRUCTION Phase Evidence 能完整重建当前进度
   - 若不能，补录缺失信息后再压缩

4. 重置完成后，进入下一个 Issue 前，必须先执行 2.2.8 Constraint Reinjection Protocol
```

**禁止行为**：
- 不得为了"方便"而保留上一个 Issue 的完整 TDD 讨论或 review 原始文本
- 不得跳过压缩直接进入下一个 Issue

---

#### 2.2.8 Constraint Reinjection Protocol — 强制约束重注协议（强制）

**目标**：每个新 Issue 开始前，将当前阶段的 CRITICAL 约束重新注入活跃上下文，防止规则遗忘。

**执行时机**：每个 Issue 开始前（紧接在 2.2.7 之后，或会话恢复断点后）。

**重注内容（精简版，不可删减）**：

```
【当前阶段】CONSTRUCTION
【阶段目标】按依赖顺序对每个垂直切片执行 TDD + Review + QA + Test
【当前 Issue】#[编号] — [标题]（[已完成数+1 / 总数]）

=== 强制约束（不可覆盖）===
1. 严禁跳过阶段：CONSTRUCTION 的所有子阶段（2.1-2.8）必须按顺序执行
2. 严禁替换 skill 调用：/tdd /review /qa 必须以 skill 调用方式执行，不得以手动操作替代
3. 严禁主观判断替代规则：不得以"足够简单"为由省略 review 或 QA
4. 产出物落盘：每个子阶段必须有明确的产出物（代码/测试/review文件/记录）
5. 违规即录：发现偏差先记录到 state.md，优先自动修正，仅严重阻塞时暂停

=== 阶段转换门（CONSTRUCTION 完成标准）===
- 所有 GitHub Issue 已关闭
- 每个 Issue 都有对应的 .omni-wf/reviews/issue-NNN.md
- 每个 review 记录都显示 PASS
- 每个前端 Issue 都有 QA PASS 记录
- 所有项目测试通过
- state.md 中 CONSTRUCTION Phase Evidence 已记录
```

**重注方式**：
- 主 agent 在每个 Issue 开始时，将上述内容作为**第一条系统消息**输出给自己
- 若使用 subagent，将上述内容作为上下文包中的 `phase_constraints` 字段传入

---

### 2.3 Per-Issue TDD — 测试驱动编码（引入 aidlc construction 规范）

**目标**：为每个 Issue 编写测试 + 实现，遵循垂直切片原则。

**调用技能**：`/tdd`

**执行规则**：

> **入口检查点**：执行本阶段前，确认 2.2.8 Constraint Reinjection Protocol 已生效，当前处于 CONSTRUCTION Phase，Issue 编号正确。

#### 2.2.1 Planning（必须）

运行 matt-skills `/tdd` 的 Planning 步骤：
- [ ] 确认公共接口设计
- [ ] 确认需要测试的行为（优先级排序）
- [ ] 识别 deep modules 机会
- [ ] 设计可测试的接口
- [ ] 列出要测试的行为列表
- [ ] **获取用户批准**

**引入 aidlc construction 规范**：
- 检查 NFR 需求（性能、安全、可扩展性）
- 确认代码生成规范（命名、注释、错误处理）
- 检查基础设施设计（是否需要新服务/配置）

#### 2.2.2 Tracer Bullet（必须）

- 编写第一个测试（RED）
- 编写最小实现通过测试（GREEN）

#### 2.2.3 Incremental Loop（必须）

对每个剩余行为：
- RED：编写下一个测试 → 失败
- GREEN：最小代码通过 → 成功

**规则**：
- 一次只写一个测试
- 只写足够通过当前测试的代码
- 绝不猜测未来需求

#### 2.2.4 Refactor（必须）

- 全部测试通过后重构
- 提取重复代码
- 深化模块
- 应用 SOLID 原则

**严禁**：在 RED 状态重构。

记录当前 Issue 的 TDD 进度到 state.md。继续下一个测试或自动进入 Review。

---

### 2.4 Per-Issue Review — 代码审查（必须）

**目标**：对每个 Issue 的代码进行安全性和质量审查。

**调用技能**：`/review`

**执行规则**：

> **入口检查点**：执行本阶段前，确认 2.2.8 Constraint Reinjection Protocol 已生效，当前 Issue 的 TDD 阶段已完成，未跳过任何前置子阶段。

- **必须**运行 gstack `/review`
- 检查全部 9 项：
  1. SQL & 数据安全
  2. 竞态条件 & 并发
  3. LLM 信任边界
  4. Shell 注入
  5. 枚举完整性
  6. 异步/同步混合
  7. 类型安全
  8. 前端可访问性
  9. 超时安全

**强制要求**：
- review 发现的问题**必须**修复后重新 review
- 只有 review 通过才能进入下一步
- **必须**将 review 输出保存到 `.omni-wf/reviews/issue-NNN.md`

---

### 2.5 Per-Issue QA — 前端验证（条件：Issue 涉及前端变更时必须执行）

**目标**：验证前端 Issue 的交互和视觉质量。

**调用技能**：`/qa`

**执行规则**：

> **入口检查点**：执行本阶段前，确认 2.2.8 Constraint Reinjection Protocol 已生效，当前 Issue 的 Review 阶段已通过，未跳过任何前置子阶段。

- **若当前 Issue 涉及前端变更（文件包含 .tsx/.jsx/.css/.vue/.svelte/.html）：必须执行**
- 运行 gstack `/qa`

**强制要求**：
- QA 发现 bug **必须**修复后重新 QA
- 只有 QA 通过才能进入下一步
- **必须**将 QA 报告追加到 `.omni-wf/reviews/issue-NNN.md`

---

### 2.6 Per-Issue Test — 项目测试（必须）

**目标**：确保当前 Issue 不破坏现有功能。

**执行规则**：

> **入口检查点**：执行本阶段前，确认 2.2.8 Constraint Reinjection Protocol 已生效，当前 Issue 的 Review（及 QA，如适用）阶段已通过，未跳过任何前置子阶段。

- 运行项目测试 suite
- **必须**全部通过

**强制要求**：
- 失败 → `/investigate` → 修复 → 重新测试

---

### 2.7 关闭 Issue（只有 2.3-2.6 全部通过后才能执行）

> **入口检查点**：关闭前必须自验证：当前 Issue 的 TDD（2.3）→ Review（2.4）→ QA（2.5，如适用）→ Test（2.6）全部通过。若任一环节缺失，回退到该环节重新执行，不得提前关闭。

```bash
gh issue close NNN --comment "Completed via omni-wf CONSTRUCTION phase. Review: PASS. QA: [PASS/N/A]. Tests: PASS."
```

### 2.8 记录完成证据（每个 Issue 必须）

更新 state.md 的 CONSTRUCTION Phase Evidence：

```markdown
### CONSTRUCTION Phase
- Completed At: [部分完成时为最新时间]
- Evidence:
  - Issues completed: [N / total N]
  - Per-Issue Review Status:
    - #42 — review: PASS, qa: PASS, tests: PASS, worktree: ~/.worktrees/labs/feat-auth-system
    - #43 — review: PASS, qa: N/A, tests: PASS, worktree: ~/.worktrees/labs/feat-auth-system
- User Confirmation: [待确认]
```

**Issue 收尾**：当前 Issue 完成后，必须先执行 **2.2.7 Per-Issue Context Reset Protocol** 压缩上下文，再执行 **2.2.8 Constraint Reinjection Protocol** 为下一个 Issue 重注约束，然后才能继续。

**循环**：回到 2.1，直到所有 Issue 完成。

**当所有 Issue 关闭**：
- 展示构建摘要 + 所有 review 记录
- 自动记录验证清单到 state.md，标记 CONSTRUCTION 完成，进入 TEST。

---

### CONSTRUCTION 阶段转换门

```
□ 所有 GitHub Issue 已关闭
□ 每个 Issue 都有对应的 .omni-wf/reviews/issue-NNN.md
□ 每个 review 记录都显示 PASS
□ 每个前端 Issue 都有 QA PASS 记录
□ 所有项目测试通过
□ state.md 中 CONSTRUCTION Phase Evidence 已记录
```

---

## Phase 3: TEST — 系统集成验证

**目标**：在合并前进行全面质量验证。
**强制要求**：所有验证项目必须通过后，方可进入 SHIP。

### 3.1 Integration Tests — 项目级测试（必须）

运行项目测试 suite（自动检测或读取 CLAUDE.md）：

```bash
if [ -f package.json ]; then
  if grep -q '"test"' package.json; then npm test
  elif grep -q '"test:unit"' package.json; then npm run test:unit
  elif command -v bun >/dev/null 2>&1; then bun test
  fi
fi
```

**必须**：测试全部通过。失败 → `/investigate` → 修复 → 重新测试。

### 3.2 Browser Validation（HAS_FRONTEND > 0 时必须执行）

若 `HAS_FRONTEND > 0`：
- **必须**使用 gstack `$B` 进行浏览器验证
- **必须**截图记录

### 3.3 Design Audit（HAS_FRONTEND > 0 时必须执行）

若 `HAS_FRONTEND > 0`：
- **必须**运行 `/design-review`

### 3.4 Security Audit（HAS_SECURITY > 0 时必须执行）

若 `HAS_SECURITY > 0`：
- **必须**运行 `/cso`

### 3.5 Bug Investigation（发现 Bug 时必须执行）

若测试或 QA 发现 Bug：
- **必须**运行 `/investigate`
- 根因分析 → 修复 → 回归测试

### 3.6 记录完成证据（必须）

```markdown
### TEST Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - Unit tests: [pass/fail] ([N]/[N] passed)
  - Browser validation: [PASS / N/A]
  - Design audit: [PASS / N/A]
  - Security audit: [PASS / N/A]
  - Bug investigations: [N]
- Auto Advance: true
```

自动记录验证报告到 state.md，标记 TEST 完成，进入 SHIP。

---

### TEST 阶段转换门

```
□ 项目测试全部通过（有输出记录）
□ 若 HAS_FRONTEND > 0：浏览器验证 + 设计审计全部通过
□ 若 HAS_SECURITY > 0：安全审计通过
□ 无未解决的 Bug
□ state.md 中 TEST Phase Evidence 已记录
```

---

## Phase 4: SHIP — 发布部署

**目标**：安全地将代码发布到主分支。
**强制要求**：所有子阶段必须按顺序执行。

### 4.1 Pre-merge Review — 预合并评审（必须）

**必须**运行 gstack `/review`：
- 检查清单 5 大安全项
- 检查清单 4 信息项
- 问题分类 → AUTO-FIX / ASK / CLEAR

### 4.2 Performance Baseline（HAS_FRONTEND > 0 时必须执行）

若 `HAS_FRONTEND > 0`：
- **必须**运行 `/benchmark`

### 4.3 Release — 版本发布（必须）

**必须**运行 gstack `/ship`：
1. 检测并合并 base 分支
2. 运行测试
3. Review diff
4. Bump VERSION
5. 更新 CHANGELOG
6. Commit + Push
7. 创建 PR

### 4.4 Deploy — 部署（必须）

**必须**运行 gstack `/land-and-deploy`：
1. 合并 PR
2. 等待 CI
3. 部署

### 4.5 Canary — 金丝雀监控（必须）

**必须**运行 `/canary`：
- 快照对比
- 错误监控
- 性能检测

### 4.6 记录完成证据（必须）

```markdown
### SHIP Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - /review: [PASS / issues found and fixed]
  - /benchmark: [PASS / N/A]
  - /ship: PR #[N] created
  - /land-and-deploy: deployed at [URL]
  - /canary: [健康通过 / 异常]
- User Confirmation: [待确认]
```

### 4.7 清理与复盘（必须）

1. 更新 `docs/decisions/README.md`，标记所有决策为 FINAL
2. 在 PR 描述中引用 `docs/prds/` 和 `docs/decisions/` 路径
3. 归档 `.omni-wf/state.md` 到 `.omni-wf/archive/`

**DONE.** 工作流完成。

---

### SHIP 阶段转换门（终态确认）

```
□ /review 预合并评审通过
□ 若 HAS_FRONTEND > 0：/benchmark 性能基线通过
□ /ship PR 已创建
□ /land-and-deploy 部署成功
□ /canary 金丝雀监控健康
□ state.md 中 SHIP Phase Evidence 已记录
```

---

## 状态管理规范

### state.md 格式

```markdown
# Omni Workflow State

## Current Phase: [IDLE | INCEPTION | CONSTRUCTION | TEST | SHIP]
## Current Stage: [具体子阶段名]
## Branch: [分支名]
## Worktree Path: [~/.worktrees/{repo}/{branch}]
## Started At: [ISO8601]
## Last Updated: [ISO8601]

## Completed Phases
- [x] INCEPTION (completed at: ...)
- [x] CONSTRUCTION (completed at: ...)
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence
（每个阶段的完成证据详细记录）

### INCEPTION Phase
...

### CONSTRUCTION Phase
...

### TEST Phase
...

### SHIP Phase
...

## PRDs
- docs/prds/NNN-{title}.md — [状态]

## GitHub Issues
- #42 — [标题] — [open | closed]
- #43 — [标题] — [open | closed]

## Pending Decisions
- [DECISION-NNN] [摘要] — 等待确认

## Notes
```

### 决策索引表（docs/decisions/README.md）

```markdown
# 决策索引

## 活跃决策

| ID | 标题 | 来源 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|------|---------|
| DECISION-001 | use-jwt | office-hours | INCEPTION | PENDING | ... | ... |
| DECISION-002 | postgres | eng-review | INCEPTION | PENDING | ... | ... |

## 已归档决策

| ID | 标题 | 来源 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|------|---------|
```

**每次生成新的 Decision 后必须更新此索引表。**

---

## 错误恢复

| 场景 | 恢复策略 |
|------|---------|
| 子技能失败 | 记录失败原因到 state.md，自动重试一次，仍失败则降级为本地文档继续 |
| 测试失败 | `/investigate` → 修复 → 回归测试 |
| 用户打断 | 保存当前 state.md，标记 `INTERRUPTED`，支持 `/context-save` 后恢复 |
| 依赖缺失 | 自动尝试安装（如 `bun install`），失败则记录到 state.md 并降级 |
| 无 git 仓库 | 降级为纯文档工作流，跳过 git 相关阶段 |
| gh CLI 未登录 | 降级为本地 Issue 跟踪（临时文件），记录到 state.md |
| GitHub Issue 创建失败 | 降级为本地 Issue 文件（临时保存），待修复后迁移 |
| 合并冲突 | 记录冲突文件到 state.md，尝试自动解决，失败则暂停等待用户 |
| Agent 跳过阶段 | 自动回退到被跳过的阶段起点，补齐遗漏产出物后继续 |
| 阶段转换门未通过 | 自动回退到未通过项，补齐后重新自验证 |

---

## 快速启动

用户首次使用时的引导：

> 欢迎使用 Omni Workflow。
>
> **执行约束提醒**：本工作流的所有阶段和子阶段都是强制的。严禁跳过、简化或主观修改。流程调整须经用户明确要求后执行。
>
> 当前分支：`$_BRANCH`
> 变更文件数：`$_FILE_COUNT`
>
> 请描述你想要实现的需求，或确认从现有变更开始。
>
> 工作流状态：`.omni-wf/state.md`
> PRD：`docs/prds/`
> 决策：`docs/decisions/`
> Issue：GitHub（`omni-wf` label）
>
> 工作流将按以下顺序执行：
> INCEPTION（需求明确 + 架构锁定）→ CONSTRUCTION（垂直切片编码 + 审查）→ TEST（系统集成验证）→ SHIP（发布部署）
>
> 若你已有 PRD 并希望快速审查后进入构建，使用 `/prd-audit` 替代入口：
> PRD_AUDIT（PRD 审查 + Bug 发现 + 改进建议）→ CONSTRUCTION → TEST → SHIP
