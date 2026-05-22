---
name: omni-wf
description: |
  Omni Workflow — 通用自主开发工作流编排器。
  将 Think → Plan → PRD → Issues → TDD-Build → Test → Ship 串联为一条自动化管道。
  自动检测变更范围，路由到合适的评审技能，驱动现有 gstack / matt-skills 完成全流程。
  在 Claude CLI / OpenCode 中加载后，输入需求即可自主执行。
triggers:
  - omni-wf
  - omni workflow
  - start workflow
  - 开始工作流
  - 自主开发
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - WebSearch
---

# Omni Workflow — 自主开发工作流

## CRITICAL — 执行约束（必读，违反 = 立即停止）

**本工作流的所有阶段和步骤都是强制的。严禁跳过、简化或主观修改。**

### 禁止行为（Agent 绝对不可做）

| 禁止项 | 说明 |
|--------|------|
| 跳过阶段 | 不得以"学习项目"、"足够简单"、"不需要"等理由跳过任何阶段 |
| 跳过步骤 | 阶段内的每一个步骤都必须完整执行，不得以"大同小异"省略 |
| 提前进入下一阶段 | 当前阶段未提供可验证的完成证据前，不得进入下一阶段 |
| 替换 skill 调用 | 不得以其他操作替代文档中明确要求的 `/skill-name` 调用 |
| 主观判断替代规则 | 不得以个人判断覆盖文档中的路由规则或条件判断 |

### 强制要求（Agent 必须做）

| 要求 | 说明 |
|------|------|
| 完整执行 | 每个阶段必须执行文档中列出的**所有**步骤 |
| 证据记录 | 每个阶段完成后必须在 state.md 中记录可验证的完成证据 |
| 用户确认 | 每个阶段转换必须通过 AskUserQuestion 获得用户明确批准 |
| 违规即停 | 发现任何偏差必须立即停止工作流，向用户报告，等待指示 |
| 条件即执行 | 文档中标注"若 XXX > 0，必须 XXX"的条件，一旦触发必须执行 |

### 违规处理协议

```
发现违规 → 立即停止工作流
         → 向用户报告具体违规行为（阶段、步骤、原因）
         → 等待用户明确指示
         → 不得自行"修复"或"调整"后继续
```

---

## 核心理念

Omni Workflow 的运行时就是 AI 代理本身。工作流是**提示词管道**，不是代码管道。

本技能不替代 gstack 或 matt-skills 的单个技能，而是**编排器**：
- 检测范围 → 路由评审 → 生成 PRD → 拆分 Issue → TDD 构建 → QA 验证 → 发布部署
- 每一步调用已有的专业技能完成具体工作
- 状态落盘到项目文档目录，支持断点续作

---

## 项目目录规范

```
/your-project/
├── docs/
│   ├── prds/                 # PRD 目录（最终状态，大而全）
│   │   └── 001-auth-system.md
│   ├── decisions/            # 动态增量决策日志（PDR / ADR 合一）
│   │   ├── README.md         # 决策索引表（AI 自动维护）
│   │   ├── DECISION-001-use-jwt.md
│   │   └── DECISION-002-pg-over-mysql.md
│   ├── adr/                  # ADR 目录（matt-skills 惯例）
│   │   └── ADR-001-cache-strategy.md
│   └── specs/                # 技术规格与技术方案
│       └── SPEC-001-oauth-db-design.md
│
├── .omni-wf/
│   ├── state.md              # 工作流状态（阶段/进度/证据）
│   └── reviews/              # 逐 Issue review 记录（BUILD 阶段产出）
│       └── issue-001.md
│
└── GitHub Issues             # Issue 垂直切片（通过 gh CLI 管理，omni-wf label）
```

### 命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| PRD | `NNN-{short-title}.md` | `001-auth-system.md` |
| Decision | `DECISION-NNN-{short-title}.md` | `DECISION-001-use-jwt.md` |
| ADR | `ADR-NNN-{short-title}.md` | `ADR-001-cache-strategy.md` |
| Spec | `SPEC-NNN-{short-title}.md` | `SPEC-001-oauth-db-design.md` |
| Review | `issue-NNN.md` | `issue-001.md` |

- `NNN`: 3 位零填充序号，递增
- `short-title`: 小写，kebab-case，不含日期

### 文档关联规则

- PRD 文件头部的 `## Source` 段落记录关联的决策
- Decision 文件头部的 `## Related PRD` 段落记录关联的 PRD
- GitHub Issue body 的 `## Parent PRD` 段落引用本地 PRD 路径
- GitHub Issue body 的 `## Related Decisions` 段落引用本地决策路径
- Review 文件头部的 `## Issue` 段落引用 GitHub Issue 编号

---

## 前置依赖

本技能运行前必须已安装：
- **gstack** (`~/.claude/skills/gstack/` 或 `~/.agents/skills/gstack/` 存在)
- **matt-skills** (`~/.claude/skills/` 或 `~/.agents/skills/` 下存在 `tdd`, `to-prd`, `to-issues`)
- **gh CLI**（用于创建和管理 GitHub Issues）

若未安装，提示用户先执行对应项目的 `./setup`。**不得在未安装依赖的情况下继续工作流。**

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
  _EXPECTED="THINK PLAN ISSUES BUILD TEST SHIP"
  echo "COMPLETED_PHASES: $_COMPLETED"

  # 检查是否有未完成的阶段被标记为完成（顺序错乱）
  _FOUND_SKIP="no"
  for phase in THINK PLAN ISSUES BUILD TEST SHIP; do
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

# --- 决策索引更新（如果存在）---
if [ -f "docs/decisions/README.md" ]; then
  _DECISION_COUNT=$(ls -1 docs/decisions/DECISION-*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "DECISION_INDEX: $_DECISION_COUNT entries"
else
  echo "DECISION_INDEX: 0 (no README)"
fi
```

---

## 阶段总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Omni Workflow 管道                                                      │
│                                                                         │
│  [THINK] → [PLAN] → [ISSUES] → [BUILD] → [TEST] → [SHIP]               │
│                                                                         │
│  阶段转换门: 每个 → 前必须通过验证清单 + 用户确认                         │
│  每阶段强制: state.md 更新 + 决策落盘 + 决策索引维护 + 完成证据记录         │
│  违规处理: 发现跳过/遗漏 → 立即停止 → 报告用户 → 等待指示                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: 入口与状态恢复

1. **读取 `.omni-wf/state.md`**（如果存在）。提取 `Current Phase`、`Current Stage`、`Phase Completion Evidence`。
2. **检查 `PHASE_SKIP_DETECTED`**：
   - 若 `yes`：**立即停止工作流**，向用户报告检测到的跳过行为
   - 要求用户明确指示如何处理（回退到缺失阶段 / 承认跳过并继续 / 重新开始）
3. **若 `Current Phase` 不是 `IDLE`**：
   - 向用户展示当前状态摘要 + 已完成阶段 + 未完成阶段
   - 展示每个已完成阶段的证据摘要
   - 问："是否从 `$_STAGE` 继续？" 或 "重新开始新工作流？"
4. **若重新开始**：重置 `state.md` 为 IDLE，清空所有 `pending` 和 `evidence`。

### state.md 初始化模板

```markdown
# Omni Workflow State

## Current Phase: IDLE
## Current Stage: none
## Branch: $_BRANCH
## Started At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
## Last Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Completed Phases
- [ ] THINK
- [ ] PLAN
- [ ] ISSUES
- [ ] BUILD
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence

### THINK Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

### PLAN Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

### ISSUES Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

### BUILD Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]
- Per-Issue Review Status: [待记录]

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

**STOP.** 等待用户确认继续或重新开始。

---

## 阶段转换门（通用规则，适用于所有阶段）

**任何阶段转换前，Agent 必须执行以下检查。缺少任何一项 = 禁止转换。**

### 强制验证清单

```
□ 当前阶段的所有步骤已完整执行
□ state.md 中当前阶段的 Phase Completion Evidence 已记录
□ 文档要求的技能调用已全部执行（无遗漏）
□ 用户通过 AskUserQuestion 明确批准进入下一阶段
□ 当前阶段无 Pending Decision 未解决
```

### 阶段转换协议

```
1. Agent 自验证：对照文档检查当前阶段完成度
2. 若发现遗漏：停止，向用户报告遗漏项，等待指示
3. 若全部完成：向用户展示完成摘要 + 证据列表
4. AskUserQuestion: "当前阶段已完成。是否进入 [下一阶段]？"
5. 用户批准：更新 state.md（标记当前阶段完成，记录证据，设置下一阶段）
6. 用户拒绝：停留在当前阶段，根据用户反馈调整
```

**严禁**：未经用户批准擅自进入下一阶段。

---

## Phase 1: THINK — 范围检测与评审路由

**目标**：理解本次变更的范围和性质，决定评审路由。
**强制要求**：本阶段必须完成所有步骤后方可进入 PLAN。

### 1.1 变更范围分析（必须执行）

从 Preamble 已获得 `CHANGED_FILES` 和各类特征标志。按以下规则路由：

| 文件数 | 类型判断 | 必须执行的评审 |
|--------|---------|--------------|
| >20    | 宏大变更 | `/autoplan` → CEO→Design→Eng→DX |
| 5-20   | 功能级   | `/plan-eng-review` + 条件叠加 |
| <5     | 增量     | **跳过 THINK 评审**，直接进入 PLAN |
| Bug    | 缺陷修复 | `/investigate` → 进入 PLAN |
| 前端>0 | 有 UI    | **必须叠加** `/plan-design-review` + `/design-review` |
| 安全>0 | 安全敏感 | **必须叠加** `/cso`（安全审计） |
| API>0  | 对外接口 | **必须叠加** `/plan-devex-review` |

**注意**："<5 文件"和"Bug"是文档中**唯一**允许跳过 THINK 评审的条件。其他情况必须执行对应评审。

### 1.2 执行评审（必须调用文档指定的技能）

**宏大变更（>20 文件）**：
1. **必须**运行 `/autoplan`（gstack 自动评审管道）
2. 等待 `/autoplan` 完成，读取设计文档
3. 提取所有关键决策点

**功能级（5-20 文件）**：
1. **必须**运行 `/plan-eng-review`
2. 若 `HAS_FRONTEND > 0`，**必须**叠加运行 `/plan-design-review`
3. 若 `HAS_SECURITY > 0`，**必须**叠加运行 `/cso`
4. 若 `HAS_API > 0`，**必须**叠加运行 `/plan-devex-review`

**增量/Bug（<5 文件或 Bug）**：
- 跳过 THINK 评审
- 在 state.md 记录 "THINK skipped: incremental change (N files)" 或 "THINK skipped: bug fix"

### 1.3 决策落盘（必须）

每个评审结论提取核心决策，写入 `docs/decisions/DECISION-NNN-{short-title}.md`。

```markdown
# Decision: DECISION-NNN-{short-title}

## Phase: THINK
## Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
## Status: PENDING

## Context
[决策背景]

## Options Considered
1. [选项A] — [理由]
2. [选项B] — [理由]

## Decision
[最终决策]

## Consequences
[正面和负面影响]

## Related PRD
[关联 PRD，若无则 omit]
```

**强制**：生成决策后，更新 `docs/decisions/README.md` 索引表。

### 1.4 记录完成证据（必须）

更新 state.md 的 Phase Completion Evidence：

```markdown
### THINK Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - Changed files: $_FILE_COUNT
  - Routing: [具体路由方案]
  - Decisions: [DECISION-NNN, ...]
  - Review skills called: [/autoplan, /plan-eng-review, ...]
- User Confirmation: [待确认]
```

### 1.5 阶段转换门

执行强制验证清单：

```
□ 范围分析已完成（文件数 + 特征标志已记录）
□ 评审技能已按路由规则调用（若适用）
□ 所有决策已落盘到 docs/decisions/
□ 决策索引表已更新
□ state.md 中 THINK Phase Evidence 已记录
```

全部通过 → AskUserQuestion 用户确认 → 进入 PLAN。

**STOP.** 展示 THINK 阶段摘要 + 证据 + 验证清单，询问用户是否进入 PLAN。

---

## Phase 2: PLAN — 需求细化与 PRD 生成

**目标**：将评审输出或用户需求转化为可执行的 PRD。
**强制要求**：本阶段必须生成 PRD 并保存到 `docs/prds/` 后方可进入 ISSUES。

### 2.1 上下文准备（必须）

1. 读取项目 `CLAUDE.md`（若存在）
2. 读取 `CONTEXT.md`（若存在）
3. 读取 `docs/adr/`（若存在）

### 2.2 运行 `/to-prd`（必须）

调用 matt-skills 的 `to-prd` 技能：
1. 将所有上下文组织成 PRD 输入
2. **必须**运行 `/to-prd`
3. 获取生成的 PRD 内容

### 2.3 PRD 保存到 docs/prds/（必须）

按命名规范保存：

```bash
_PRD_COUNT=$(ls -1 docs/prds/*.md 2>/dev/null | wc -l | tr -d ' ')
_NEXT_ID=$(printf "%03d" $((_PRD_COUNT + 1)))
```

保存格式：
```markdown
# 001-{short-title}

## Source
- 评审文档: [路径]
- 用户需求: [摘要]
- 分支: $_BRANCH
- 日期: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Related Decisions
- docs/decisions/DECISION-NNN-{title}.md

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

### 2.4 记录完成证据（必须）

```markdown
### PLAN Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - PRD: docs/prds/NNN-{title}.md
  - User stories count: [N]
  - Implementation decisions: [N]
- User Confirmation: [待确认]
```

### 2.5 阶段转换门

```
□ PRD 已保存到 docs/prds/ 且格式正确
□ PRD 包含所有必要章节（Problem/Solution/User Stories/Implementation/Testing/Out of Scope）
□ 关联决策已记录在 PRD 中
□ state.md 中 PLAN Phase Evidence 已记录
```

**STOP.** 展示 PRD 摘要 + 证据 + 验证清单，询问用户是否进入 ISSUES。

---

## Phase 3: ISSUES — 垂直切片拆分（GitHub Issues）

**目标**：将 PRD 拆分为可独立抓取、可追踪的垂直切片 Issue。
**强制要求**：本阶段必须将所有切片发布到 GitHub Issues 后方可进入 BUILD。

### 3.1 运行 `/to-issues`（必须）

调用 matt-skills 的 `to-issues` 技能：
1. 以 PRD 为输入
2. **必须**运行 `/to-issues`
3. 获取垂直切片列表

### 3.2 发布到 GitHub Issues（必须）

对每个垂直切片，**必须**通过 `gh issue create` 发布：

```bash
gh issue create \
  --title "[Slice-N] {标题}" \
  --body "$(cat <<'EOF'
## Parent PRD
{PRD 文件路径}

## Type
[HITL | AFK]

## What to build
[垂直切片描述 — 端到端行为]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Blocked by
[GitHub Issue #XXX | None]

## Related Decisions
- docs/decisions/DECISION-NNN-{title}.md

## Status
OPEN
EOF
)" \
  --label "omni-wf"
```

**规则**：
- 按依赖顺序发布（blockers 优先）
- 在 blocker Issue 中引用被阻塞 Issue
- 统一使用 `omni-wf` label
- **必须**记录返回的 Issue 编号

### 3.3 记录完成证据（必须）

```markdown
### ISSUES Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - Issues created: [#42, #43, ...]
  - Total slices: [N]
  - HITL slices: [N]
  - AFK slices: [N]
- User Confirmation: [待确认]
```

### 3.4 阶段转换门

```
□ 所有垂直切片已发布到 GitHub（有 Issue 编号）
□ 每个 Issue 带有 omni-wf label
□ 依赖关系已在 Issue body 中标注
□ state.md 中 ISSUES Phase Evidence 已记录
```

**STOP.** 展示 Issue 列表 + 依赖图 + 验证清单，询问用户是否进入 BUILD。

---

## Phase 4: BUILD — TDD 逐 Issue 编码 + 强制审查

**目标**：按依赖顺序，对每个 GitHub Issue 执行 TDD 开发 + 代码审查 + QA。
**强制要求**：每个 Issue 完成后**必须**执行 `/review` +（前端变更则 `/qa`）+ 测试，方可标记为完成。

### 4.1 选择下一个 Issue（必须按依赖顺序）

从 GitHub 查询 `omni-wf` label 下状态为 `open` 且 blocker 已关闭的 Issue：

```bash
gh issue list --label omni-wf --state open --json number,title,body
```

若无可用 Issue，BUILD 阶段完成。

### 4.2 读取 Issue 和关联文档（必须）

通过 `gh issue view NNN` 读取，并读取：
- 关联的 PRD（本地路径）
- 关联的 Decision（本地路径）

### 4.3 TDD 循环（必须）

调用 matt-skills 的 `/tdd`：

```
1. 确认公共接口设计
2. 编写第一个 Tracer Bullet 测试（RED）
3. 最小实现通过测试（GREEN）
4. 增量循环：下一个测试 → 实现 → 通过
5. 全部通过后重构
```

**规则**：
- 一次只写一个测试
- 只写足够通过当前测试的代码
- 绝不猜测未来需求
- 重构必须在 GREEN 状态

### 4.4 强制审查 — 每个 Issue 完成后必须执行

**4.4.1 代码审查 `/review`（必须）**

```
运行 gstack `/review` 技能，检查全部 9 项：
- SQL & 数据安全
- 竞态条件 & 并发
- LLM 信任边界
- Shell 注入
- 枚举完整性
- 异步/同步混合
- 类型安全
- 前端可访问性
- 超时安全
```

**强制要求**：
- review 发现的问题**必须**修复后重新 review
- 只有 review 通过才能进入下一步
- **必须**将 review 输出保存到 `.omni-wf/reviews/issue-NNN.md`

**4.4.2 QA 验证（前端变更时必须）**

```
如果当前 Issue 涉及前端变更（变更文件包含 .tsx/.jsx/.css/.vue/.svelte/.html）：
运行 gstack `/qa` 技能
```

**强制要求**：
- QA 发现 bug **必须**修复后重新 QA
- 只有 QA 通过才能进入下一步
- **必须**将 QA 报告追加到 `.omni-wf/reviews/issue-NNN.md`

**4.4.3 项目测试套件（必须）**

```bash
npm test  # 或项目特定测试命令
```

**强制要求**：
- 测试必须全部通过
- 失败则 `/investigate` → 修复 → 重新测试

### 4.5 关闭 Issue（只有 4.4 全部通过后才能执行）

```bash
gh issue close NNN --comment "Completed via omni-wf BUILD phase. Review: PASS. QA: [PASS/N/A]. Tests: PASS."
```

### 4.6 记录完成证据（每个 Issue 必须）

更新 state.md 的 BUILD Phase Evidence：

```markdown
### BUILD Phase
- Completed At: [部分完成时为最新时间]
- Evidence:
  - Issues completed: [N / total N]
  - Per-Issue Review Status:
    - #42 — review: PASS, qa: PASS, tests: PASS
    - #43 — review: PASS, qa: N/A, tests: PASS
- User Confirmation: [待确认]
```

### 4.7 阶段转换门

```
□ 所有 GitHub Issue 已关闭
□ 每个 Issue 都有对应的 .omni-wf/reviews/issue-NNN.md
□ 每个 review 记录都显示 PASS
□ 每个前端 Issue 都有 QA PASS 记录
□ 所有项目测试通过
□ state.md 中 BUILD Phase Evidence 已记录
```

**循环**：回到 4.1，直到所有 Issue 完成。

**当所有 Issue 关闭**：
- 展示构建摘要 + 所有 review 记录
- **STOP.** 展示验证清单，询问用户是否进入 TEST。

---

## Phase 5: TEST — 多层验证

**目标**：在合并前进行全面质量验证。
**强制要求**：本阶段所有验证项目必须通过后，方可进入 SHIP。

### 5.1 项目级测试（必须）

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

### 5.2 前端验证（HAS_FRONTEND > 0 时必须）

若 `HAS_FRONTEND > 0`：
1. **必须**使用 gstack `$B` 进行浏览器验证
2. **必须**运行 `/qa`
3. **必须**运行 `/design-review`

### 5.3 安全验证（HAS_SECURITY > 0 时必须）

若 `HAS_SECURITY > 0`：
- **必须**运行 `/cso`

### 5.4 Bug 调试（发现 Bug 时必须）

若测试或 QA 发现 Bug：
- **必须**运行 `/investigate`
- 根因分析 → 修复 → 回归测试

### 5.5 记录完成证据（必须）

```markdown
### TEST Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - Unit tests: [pass/fail] ([N]/[N] passed)
  - Browser validation: [PASS / N/A]
  - QA: [PASS / N/A]
  - Design review: [PASS / N/A]
  - Security audit: [PASS / N/A]
  - Bug investigations: [N]
- User Confirmation: [待确认]
```

### 5.6 阶段转换门

```
□ 项目测试全部通过（有输出截图/记录）
□ 若 HAS_FRONTEND > 0：浏览器验证 + QA + design-review 全部通过
□ 若 HAS_SECURITY > 0：/cso 安全审计通过
□ 无未解决的 Bug
□ state.md 中 TEST Phase Evidence 已记录
```

**STOP.** 展示验证报告 + 证据 + 验证清单，询问用户是否进入 SHIP。

---

## Phase 6: SHIP — 预合并评审与发布

**目标**：安全地将代码发布到主分支。
**强制要求**：本阶段必须完成 `/review` + `/ship` + `/land-and-deploy` 后方可标记完成。

### 6.1 预合并评审 `/review`（必须）

**必须**运行 gstack `/review`：
- 检查清单 5 大安全项
- 检查清单 4 信息项
- 问题分类 → AUTO-FIX / ASK / CLEAR

### 6.2 性能基线（HAS_FRONTEND > 0 时必须）

若 `HAS_FRONTEND > 0`：
- **必须**运行 `/benchmark`

### 6.3 发布 `/ship`（必须）

**必须**运行 gstack `/ship`：
1. 检测并合并 base 分支
2. 运行测试
3. Review diff
4. Bump VERSION
5. 更新 CHANGELOG
6. Commit + Push
7. 创建 PR

### 6.4 部署 `/land-and-deploy`（必须）

**必须**运行 gstack `/land-and-deploy`：
1. 合并 PR
2. 等待 CI
3. 部署
4. **必须**运行 `/canary`

### 6.5 记录完成证据（必须）

```markdown
### SHIP Phase
- Completed At: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence:
  - /review: [PASS / issues found and fixed]
  - /benchmark: [PASS / N/A]
  - /ship: PR #[N] created
  - /land-and-deploy: deployed at [URL]
  - /canary: [健康通过 / 异常 → 回滚]
- User Confirmation: [待确认]
```

### 6.6 更新 state.md（终态）

- `Current Phase: SHIP`
- `Current Stage: deployed`
- 勾选 `[x] SHIP`

### 6.7 清理与复盘（必须）

1. 更新 `docs/decisions/README.md`，标记所有决策为 FINAL
2. 在 PR 描述中引用 `docs/prds/` 和 `docs/decisions/` 路径
3. 归档 `.omni-wf/state.md` 到 `.omni-wf/archive/`

**DONE.** 工作流完成。

---

## 状态管理与决策落盘

### state.md 格式规范

```markdown
# Omni Workflow State

## Current Phase: [IDLE | THINK | PLAN | ISSUES | BUILD | TEST | SHIP]
## Current Stage: [具体阶段名]
## Branch: [分支名]
## Started At: [ISO8601]
## Last Updated: [ISO8601]

## Completed Phases
- [x] THINK (completed at: ...)
- [x] PLAN (completed at: ...)
- [ ] BUILD
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence
（每个阶段的完成证据详细记录）

### THINK Phase
...

### PLAN Phase
...

### ISSUES Phase
...

### BUILD Phase
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

AI 自动维护的索引表：

```markdown
# 决策索引

## 活跃决策

| ID | 标题 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
| DECISION-001 | use-jwt | THINK | PENDING | 2026-05-22 | docs/prds/001-auth-system.md |

## 已归档决策

| ID | 标题 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
```

**每次生成新的 Decision 后必须更新此索引表。**

---

## 连续检查点模式

若检测到 `gstack-config get checkpoint_mode` 返回 `continuous`：
- 每完成一个 Issue，自动 `WIP:` commit
- 格式：
  ```
  WIP: omni-wf — completed issue #NNN (review: PASS, qa: PASS)

  [omni-wf-context]
  Phase: BUILD
  Issue: #NNN
  Remaining: [N issues]
  [/omni-wf-context]
  ```

---

## 错误恢复

| 场景 | 恢复策略 |
|------|---------|
| 子技能失败 | 记录失败原因到 state.md，**停止工作流**，询问用户重试/跳过/调整 |
| 测试失败 | `/investigate` → 修复 → 回归测试 |
| 用户打断 | 保存当前 state.md，标记 `INTERRUPTED`，支持 `/context-save` 后恢复 |
| 依赖缺失 | 询问用户安装，**不得在未安装的情况下继续** |
| 无 git 仓库 | 降级为纯文档工作流，跳过 git 相关阶段 |
| gh CLI 未登录 | 提示 `gh auth login`，或降级为本地 Issue 跟踪（临时） |
| GitHub Issue 创建失败 | 降级为本地 Issue 文件（临时保存），待修复后迁移 |
| 合并冲突 | 暂停 → 询问用户手动解决 → 恢复 |
| Agent 跳过阶段 | **立即停止**，报告违规，等待用户指示 |

---

## 快速启动

用户首次使用时的引导：

> 欢迎使用 Omni Workflow。
>
> **执行约束提醒**：本工作流的所有阶段和步骤都是强制的。严禁跳过、简化或主观修改。如需调整流程，必须通过 AskUserQuestion 获得用户明确批准。
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
