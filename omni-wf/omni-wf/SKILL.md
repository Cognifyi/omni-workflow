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

## 核心理念

Omni Workflow 的运行时就是 AI 代理本身。工作流是**提示词管道**，不是代码管道。

本技能不替代 gstack 或 matt-skills 的单个技能，而是**编排器**：
- 检测范围 → 路由评审 → 生成 PRD → 拆分 Issue → TDD 构建 → QA 验证 → 发布部署
- 每一步调用已有的专业技能完成具体工作
- 状态落盘到 `.omni-wf/` 目录，支持断点续作

## 前置依赖

本技能运行前必须已安装：
- **gstack** (`~/.claude/skills/gstack/` 存在，或运行过 `./setup`)
- **matt-skills** (`~/.claude/skills/` 下存在 `tdd`, `to-prd`, `to-issues` 等)

若未安装，提示用户先执行对应项目的 `./setup`。

## Preamble (run first)

```bash
# --- 状态探测 ---
_OMNI_DIR=".omni-wf"
_STATE_FILE="$_OMNI_DIR/state.md"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

mkdir -p "$_OMNI_DIR" "$_OMNI_DIR/decisions" "$_OMNI_DIR/prds" "$_OMNI_DIR/issues"

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
_GSTACK_OK=$([ -d ~/.claude/skills/gstack ] && echo "yes" || echo "no")
_MATT_OK=$([ -d ~/.claude/skills/tdd ] && echo "yes" || echo "no")
echo "GSTACK_INSTALLED: $_GSTACK_OK"
echo "MATT_INSTALLED: $_MATT_OK"
```

## 阶段总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Omni Workflow MVP 管道                                                  │
│                                                                         │
│  [THINK] → [PLAN] → [PRD] → [ISSUES] → [BUILD] → [TEST] → [SHIP]       │
│                                                                         │
│  THINK: 范围检测 + 评审路由                                               │
│  PLAN:  需求细化 + PRD 生成                                              │
│  ISSUES: 垂直切片拆分 + 本地 Issue 跟踪                                   │
│  BUILD:  逐 Issue TDD 编码 + 代码实现                                     │
│  TEST:   项目测试 + 浏览器验证 + 设计审计                                 │
│  SHIP:   预合并评审 + 版本 bump + PR + 部署                              │
│                                                                         │
│  每阶段强制: state.md 更新 + 决策落盘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: 入口与状态恢复

1. **读取 `.omni-wf/state.md`**（如果存在）。提取 `Current Phase`、`Current Stage`、`Pending Decisions`。
2. **若 `Current Phase` 不是 `IDLE`**：
   - 向用户展示当前状态摘要
   - 问："是否从 `$_STAGE` 继续？" 或 "重新开始新工作流？"
3. **若重新开始**：重置 `state.md` 为 IDLE，清空 `pending` 列表。

### state.md 初始化模板

```markdown
# Omni Workflow State

## Current Phase: IDLE
## Current Stage: none
## Branch: $_BRANCH
## Started At: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Completed Phases
- [ ] THINK
- [ ] PLAN
- [ ] ISSUES
- [ ] BUILD
- [ ] TEST
- [ ] SHIP

## Pending Decisions
None

## PRDs
None

## Issues
None

## Notes
```

**STOP.** 等待用户确认继续或重新开始。

---

## Phase 1: THINK — 范围检测与评审路由

**目标**：理解本次变更的范围和性质，决定是否需要评审、需要哪些评审。

### 1.1 变更范围分析

从 Preamble 已获得 `CHANGED_FILES` 和各类特征标志。按以下规则路由：

| 文件数 | 类型判断 | 评审路由 |
|--------|---------|---------|
| >20    | 宏大变更 | `/autoplan` → CEO→Design→Eng→DX |
| 5-20   | 功能级   | `/plan-eng-review` + 按需叠加 |
| <5     | 增量     | **跳过评审** → 直接进入 BUILD |
| Bug    | 缺陷修复 | `/investigate` → 进入 BUILD |
| 前端>0 | 有 UI    | 叠加 `/plan-design-review` + `/design-review` |
| 安全>0 | 安全敏感 | 叠加 `/cso`（安全审计） |
| API>0  | 对外接口 | 叠加 `/plan-devex-review` |

### 1.2 执行评审

**宏大变更（>20 文件）**：
1. 运行 `/autoplan`（gstack 自动评审管道）
2. 等待 `/autoplan` 完成，获取设计文档路径
3. 读取设计文档，提取关键决策

**功能级（5-20 文件）**：
1. 运行 `/plan-eng-review`（锁定架构、数据流、测试策略）
2. 若 `HAS_FRONTEND > 0`，叠加运行 `/plan-design-review`
3. 若 `HAS_SECURITY > 0`，叠加运行 `/cso`
4. 若 `HAS_API > 0`，叠加运行 `/plan-devex-review`

**增量/Bug（<5 文件或 Bug）**：
- 跳过 THINK 评审，记录 "THINK skipped: incremental change"

### 1.3 决策落盘

对每一个评审阶段，提取：
- 核心决策点
- 风险评级
- 推荐的实现路径

写入：`.omni-wf/decisions/DECISION-$(date +%s).md`

```markdown
# Decision: THINK-$(date +%s)

## Phase: THINK
## Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Scope Summary
- Changed files: $_FILE_COUNT
- Frontend: $_HAS_FRONTEND
- Security: $_HAS_SECURITY
- API: $_HAS_API
- DB: $_HAS_DB

## Routing Decision
[具体路由方案]

## Key Risks
1. [风险1]
2. [风险2]

## Recommended Path
[推荐实现路径]
```

### 1.4 更新 state.md

将 `Current Phase` 设为 `THINK`，`Current Stage` 设为 `review-complete`。
勾选 `[x] THINK`。

**STOP.** 展示 THINK 阶段摘要，询问用户是否进入 PLAN。

---

## Phase 2: PLAN — 需求细化与 PRD 生成

**目标**：将评审输出或用户需求转化为可执行的 PRD。

### 2.1 上下文准备

1. 读取项目 `CLAUDE.md`（若存在），获取项目特定的测试命令、构建命令等
2. 读取 `CONTEXT.md`（若存在），获取领域术语
3. 读取 `docs/adr/`（若存在），了解已有架构决策

### 2.2 运行 `/to-prd`

调用 matt-skills 的 `to-prd` 技能：
1. 将当前所有上下文（评审结论、用户需求、代码现状）组织成 PRD 输入
2. 运行 `/to-prd`
3. 获取生成的 PRD 内容

### 2.3 PRD 本地保存

将 PRD 保存到 `.omni-wf/prds/`：

```bash
_PRD_ID=$(printf "%03d" $(ls -1 .omni-wf/prds/PRD-*.md 2>/dev/null | wc -l | tr -d ' '))
_PRD_FILE=".omni-wf/prds/PRD-$_PRD_ID.md"
```

保存格式：
```markdown
# PRD-$_PRD_ID: [标题]

## Source
- 评审文档: [路径]
- 用户需求: [摘要]
- 分支: $_BRANCH
- 日期: $(date -u +%Y-%m-%dT%H:%M:%SZ)

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

### 2.4 更新 state.md

- `Current Phase: PLAN`
- `Current Stage: prd-generated`
- PRDs 列表追加 `PRD-$_PRD_ID`
- 勾选 `[x] PLAN`

**STOP.** 展示 PRD 摘要，询问用户是否满意并进入 ISSUES 拆分。

---

## Phase 3: ISSUES — 垂直切片拆分

**目标**：将 PRD 拆分为可独立抓取、可追踪的垂直切片 Issue。

### 3.1 运行 `/to-issues`

调用 matt-skills 的 `to-issues` 技能：
1. 以刚刚生成的 PRD 为输入
2. 运行 `/to-issues`
3. 获取垂直切片列表

### 3.2 本地 Issue 保存

每个切片保存为一个本地 Issue 文件：

```bash
for slice in "${slices[@]}"; do
  _ISSUE_ID=$(printf "%03d" $(ls -1 .omni-wf/issues/ISSUE-*.md 2>/dev/null | wc -l | tr -d ' '))
  _ISSUE_FILE=".omni-wf/issues/ISSUE-$_ISSUE_ID.md"
  # ... write file
done
```

Issue 格式：
```markdown
# ISSUE-$_ISSUE_ID: [标题]

## Parent PRD
PRD-$_PRD_ID

## Type
[HITL | AFK]

## What to build
[垂直切片描述 — 端到端行为，非分层实现]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Blocked by
[ISSUE-XXX | None]

## Status
[OPEN | IN_PROGRESS | DONE]
```

### 3.3 依赖排序

按依赖关系排序 Issue（blockers 优先）。更新每个 Issue 的 `Blocked by` 字段，引用真实的本地 Issue ID。

### 3.4 更新 state.md

- `Current Phase: ISSUES`
- `Current Stage: ready-for-build`
- Issues 列表追加所有新生成的 ISSUE-NNN
- 勾选 `[x] ISSUES`

**STOP.** 展示 Issue 列表和依赖图，询问用户是否进入 BUILD。

---

## Phase 4: BUILD — TDD 逐 Issue 编码

**目标**：按依赖顺序，对每个 Issue 执行 TDD 开发。

### 4.1 选择下一个 Issue

从 `.omni-wf/state.md` 的 Issues 列表中，选择：
- 状态为 `OPEN`
- 所有 blocker 状态为 `DONE`
- 的第一个 Issue

若无可用 Issue，BUILD 阶段完成。

### 4.2 读取 Issue

读取 `.omni-wf/issues/ISSUE-NNN.md`，提取：
- 标题和描述
- Acceptance Criteria
- 关联的 PRD 段落

### 4.3 TDD 循环

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

### 4.4 Issue 完成标记

当 Acceptance Criteria 全部满足：
1. 更新 `ISSUE-NNN.md` 状态为 `DONE`
2. 记录完成时间和提交的 commit hash
3. 运行项目测试命令（从 CLAUDE.md 读取，或自动检测 `npm test`/`bun test`）
4. 测试通过则继续下一个 Issue；失败则 `/investigate`

### 4.5 更新 state.md

- `Current Phase: BUILD`
- `Current Stage: issue-N-in-progress` 或 `build-complete`
- 更新 Issues 状态列表

**循环**：回到 4.1，直到所有 Issue 完成。

**当所有 Issue DONE**：
- `Current Stage: build-complete`
- 勾选 `[x] BUILD`
- 展示构建摘要（文件变更、测试统计）
- **STOP.** 询问是否进入 TEST。

---

## Phase 5: TEST — 多层验证

**目标**：在合并前进行全面的质量验证。

### 5.1 项目级测试

运行项目测试 suite（自动检测或读取 CLAUDE.md）：
```bash
# 检测逻辑（与 gstack 一致）
if [ -f package.json ]; then
  if grep -q '"test"' package.json; then npm test
  elif grep -q '"test:unit"' package.json; then npm run test:unit
  elif command -v bun >/dev/null 2>&1; then bun test
  fi
fi
```

### 5.2 前端验证（条件触发）

若 `HAS_FRONTEND > 0`：
1. 使用 gstack `$B`（browse binary）进行浏览器验证
2. 运行 `/qa`（gstack QA 技能）— 自动选择 Quick/Standard/Exhaustive tier
3. 运行 `/design-review`（gstack 设计审计技能）

### 5.3 安全验证（条件触发）

若 `HAS_SECURITY > 0`：
- 运行 `/cso`（gstack 安全审计）

### 5.4 Bug 调试（条件触发）

若测试或 QA 发现 Bug：
- 运行 `/investigate`（gstack 系统调试）
- 根因分析 → 修复 → 回归测试

### 5.5 更新 state.md

- `Current Phase: TEST`
- `Current Stage: qa-complete`
- 记录验证结果摘要
- 勾选 `[x] TEST`

**STOP.** 展示验证报告，询问是否进入 SHIP。

---

## Phase 6: SHIP — 预合并评审与发布

**目标**：安全地将代码发布到主分支。

### 6.1 预合并评审 `/review`

运行 gstack `/review` 技能：
1. 检查清单 5 大安全项：
   - SQL & 数据安全
   - 竞态条件 & 并发
   - LLM 信任边界
   - Shell 注入
   - 枚举完整性
2. 检查清单 4 信息项：
   - 异步/同步混合
   - 类型安全
   - 前端可访问性
   - 超时安全

### 6.2 性能基线（条件触发）

若 `HAS_FRONTEND > 0`：
- 运行 `/benchmark`（gstack 性能回归检测）

### 6.3 发布 `/ship`

运行 gstack `/ship` 技能：
1. 检测并合并 base 分支
2. 运行测试
3. Review diff
4. Bump VERSION
5. 更新 CHANGELOG
6. Commit + Push
7. 创建 PR

### 6.4 部署 `/land-and-deploy`

运行 gstack `/land-and-deploy` 技能：
1. 合并 PR
2. 等待 CI
3. 部署
4. 运行 `/canary`（金丝雀监控）

### 6.5 更新 state.md（终态）

- `Current Phase: SHIP`
- `Current Stage: deployed`
- 勾选 `[x] SHIP`
- 追加完成时间、PR 链接、部署状态

### 6.6 清理

可选：询问用户是否保留 `.omni-wf/` 目录用于复盘，或归档到 `.omni-wf/archive/`。

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

## PRDs
- PRD-001: [标题] — [状态]

## Issues
- ISSUE-001: [标题] — [OPEN | IN_PROGRESS | DONE]
- ISSUE-002: [标题] — [OPEN | IN_PROGRESS | DONE]

## Pending Decisions
- [DECISION-xxx] [摘要] — 等待确认

## Notes
[任意备注]
```

### 决策文件模板

```markdown
# Decision: DECISION-NNN

## Phase: [THINK | PLAN | BUILD | TEST | SHIP]
## Date: [ISO8601]
## Status: [PENDING | APPROVED | REJECTED]

## Context
[决策背景]

## Options Considered
1. [选项A] — 理由
2. [选项B] — 理由

## Decision
[最终决策]

## Consequences
[正面和负面影响]
```

---

## 连续检查点模式

若检测到 `gstack-config get checkpoint_mode` 返回 `continuous`：
- 每完成一个 Issue，自动 `WIP:` commit
- 格式：
  ```
  WIP: omni-wf — completed ISSUE-NNN

  [omni-wf-context]
  Phase: BUILD
  Issue: ISSUE-NNN
  Remaining: [N issues]
  [/omni-wf-context]
  ```

---

## 错误恢复

| 场景 | 恢复策略 |
|------|---------|
| 子技能失败 | 记录失败原因到 state.md，询问用户重试/跳过/调整 |
| 测试失败 | `/investigate` → 修复 → 重新运行当前阶段 |
| 用户打断 | 保存当前 state.md，标记 `INTERRUPTED`，支持 `/context-save` 后恢复 |
| 依赖缺失 | 询问用户安装 gstack/matt-skills，或跳过依赖阶段 |
| 无 git 仓库 | 降级为纯文档工作流，跳过 git 相关阶段 |

---

## 快速启动

用户首次使用时的引导：

> 欢迎使用 Omni Workflow。本工作流将指导你完成：
> THINK → PLAN → PRD → ISSUES → BUILD → TEST → SHIP
>
> 检测到当前分支：`$_BRANCH`
> 变更文件数：`$_FILE_COUNT`
>
> 请描述你想要实现的需求，或确认从现有变更开始。
