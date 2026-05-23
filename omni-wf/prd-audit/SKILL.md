---
name: prd-audit
description: |
  PRD 审查与 Issue 化入口。读取现有 PRD（本地文件或 GitHub Issue），
  审查完整性、发现潜在 Bug 与改进优化空间，引导用户选择修复范围后
  拆分为垂直切片 Issue，并接入 omni-wf 的 CONSTRUCTION → TEST → SHIP 全流程。
  作为 omni-wf 的替代入口，跳过完整 INCEPTION 评审，直接基于审查后的 PRD 进入构建。
triggers:
  - prd-audit
  - audit prd
  - review prd
  - PRD审查
  - 审查PRD
---

# PRD Audit — PRD 审查与 Issue 化入口

## CRITICAL — 执行约束

**本技能是 omni-wf 的替代入口。审查完成后必须无缝接入 omni-wf 的 CONSTRUCTION → TEST → SHIP 流程，严禁中途丢弃工作流规范。**

### 禁止行为

| 禁止项 | 说明 | 违规处理 |
|--------|------|---------|
| 跳过审查维度 | 不得省略完整性 / Bug / 改进 任一审查维度 | 回退到遗漏维度，补齐审查 |
| 未获用户确认即拆分 Issue | 修复范围必须经用户明确选择 | 暂停并重新询问用户 |
| 跳过 omni-wf 接入 | Issue 创建后必须初始化 state.md 并进入 CONSTRUCTION | 自动补齐 state.md 接入步骤 |
| 丢弃审查发现 | 用户未选择修复的 Bug/改进项必须记录到 state.md Notes | 回退补录 |

### 强制要求

| 要求 | 说明 |
|------|------|
| 产出审查报告 | 每个审查维度必须有结构化产出，保存到 `.omni-wf/prd-audits/` |
| 用户决策记录 | 用户选择（仅修 Bug / 同时优化）必须落盘到 state.md |
| PRD 关联 | 审查后的 PRD 路径必须记录到 state.md PRDs 列表 |
| 无缝衔接 | Issue 拆分完成后必须按 omni-wf 规范初始化 CONSTRUCTION 阶段 |

---

## 核心理念

`prd-audit` 是 **omni-wf 的快捷入口**，适用于以下场景：

- 用户已有 PRD（自己写的、别的团队交接的、从 Issue 中恢复的）
- PRD 质量不确定，需要 AI 辅助审查后再进入开发
- 希望跳过 INCEPTION 的多轮评审（office-hours → ceo-review → eng-review → design-review），快速进入构建

**与 omni-wf 的关系**：

```
标准 omni-wf 入口:    INCEPTION (5 子阶段) → CONSTRUCTION → TEST → SHIP
prd-audit 入口:        PRD_AUDIT → [修正 PRD] → CONSTRUCTION → TEST → SHIP
                              ↑______to-issues______↑
```

- `prd-audit` 替代 INCEPTION 阶段，但**不替代 CONSTRUCTION/TEST/SHIP**
- 审查后的 PRD 被视为"已通过 INCEPTION"，state.md 中标记 INCEPTION 为完成（附注：经由 prd-audit）
- 后续所有规则、产出物要求、阶段转换门，**完全继承 omni-wf 规范**

---

## 前置依赖

| 依赖 | 检查路径 | 用途 |
|------|---------|------|
| **omni-wf** | `~/.claude/skills/omni-wf/` 或 `~/.agents/skills/omni-wf/` | 后续 CONSTRUCTION → TEST → SHIP 编排 |
| **matt-skills** | `~/.claude/skills/tdd` 或 `~/.agents/skills/tdd` | `/to-issues` 拆分 Issue |
| **gh CLI** | `gh --version` | GitHub Issue 创建与管理 |

---

## Preamble (run first)

```bash
# --- 状态探测 ---
_OMNI_DIR=".omni-wf"
_STATE_FILE="$_OMNI_DIR/state.md"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

mkdir -p "$_OMNI_DIR" "$_OMNI_DIR/reviews" "$_OMNI_DIR/prd-audits"
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

# --- 依赖检查 ---
_OMNI_OK=$([ -d ~/.claude/skills/omni-wf ] || [ -d ~/.agents/skills/omni-wf ] && echo "yes" || echo "no")
_MATT_OK=$([ -d ~/.claude/skills/tdd ] || [ -d ~/.agents/skills/tdd ] && echo "yes" || echo "no")
_GH_OK=$(command -v gh >/dev/null 2>&1 && echo "yes" || echo "no")
echo "OMNI_WF_INSTALLED: $_OMNI_OK"
echo "MATT_INSTALLED: $_MATT_OK"
echo "GH_INSTALLED: $_GH_OK"
```

---

## Phase 0: PRD 获取

**目标**：定位并加载待审查的 PRD。

### 0.1 识别 PRD 来源

询问用户（如果未在触发参数中提供）：

```
请提供待审查的 PRD：
- 本地文件路径（如 docs/prds/001-auth-system.md）
- GitHub Issue 编号（如 #42）
- GitHub Issue URL
- 或直接粘贴 PRD 内容
```

### 0.2 加载 PRD 内容

**本地文件**：
```bash
cat "<用户提供的路径>"
```

**GitHub Issue**：
```bash
gh issue view <number> --json title,body,labels,number
```

**直接粘贴**：将内容保存为临时文件 `.omni-wf/prd-audits/_incoming_prd.md`，加载后按标准 PRD 规范处理。

### 0.3 PRD 格式规范化

若 PRD 不符合 omni-wf 标准格式，先进行规范化：

```markdown
# NNN-{short-title}

## Source
- Branch: $_BRANCH
- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Origin: [user-written / issue-recovery / team-handoff]

## Related Decisions
（如果已有决策，列出；否则标注 "待审查后补充")

## Problem Statement
...

## Solution
...

## User Stories
...

## Acceptance Criteria
...

## Testing Decisions
...

## Out of Scope
...
```

规范化后的 PRD 保存到 `docs/prds/NNN-{short-title}.md`（若原路径不在 docs/prds/ 下）。

---

## Phase 1: PRD 审查

**目标**：从三个维度系统性审查 PRD 质量，产出结构化审查报告。

### 1.1 维度一：完整性检查

对照以下清单逐项检查 PRD 是否包含关键章节：

```
□ Problem Statement（问题定义是否清晰？用户是谁？痛点是什么？）
□ Solution（方案描述是否完整？核心逻辑是否可理解？）
□ User Stories（是否有用户故事？是否覆盖主要场景？）
□ Acceptance Criteria（验收标准是否具体、可验证？）
□ Out of Scope（边界是否明确？防止范围蔓延？）
□ Testing Decisions（测试策略是否提及？）
□ Dependencies / Prerequisites（外部依赖是否列出？）
□ NFR 考虑（性能、安全、可扩展性是否提及？）
□ Error Handling（错误场景是否覆盖？）
```

**评分**：每个子项打分（完整 / 部分缺失 / 严重缺失），汇总完整性评分（0-10）。

### 1.2 维度二：Bug / 风险发现

从以下角度识别 PRD 中隐含的 Bug、逻辑矛盾或风险：

| 检查角度 | 关注内容 |
|---------|---------|
| **逻辑一致性** | 方案描述是否自相矛盾？用户故事与验收标准是否一致？ |
| **边界条件** | 空状态、极限值、并发场景、异常路径是否遗漏？ |
| **安全漏洞** | 是否涉及敏感数据处理？权限控制是否缺失？是否有注入风险？ |
| **数据一致性** | 状态变更是否原子？是否存在竞态条件？回滚策略？ |
| **依赖风险** | 外部服务失败怎么办？第三方 API 变更兼容性？ |
| **兼容性** | 是否破坏现有功能？数据库迁移策略？API 版本控制？ |
| **性能陷阱** | N+1 查询？大数据量处理？实时性要求是否可行？ |
| **可维护性** | 方案是否引入过度复杂的技术债？是否有更简单的替代方案？ |

**产出**：Bug/风险列表，每条包含：
- 严重程度：CRITICAL / HIGH / MEDIUM / LOW
- 位置：PRD 中的相关章节
- 描述：具体问题
- 影响：若不加修复的后果
- 修复建议：简要方向

### 1.3 维度三：改进优化空间

识别 PRD 可提升的价值点：

| 检查角度 | 关注内容 |
|---------|---------|
| **用户体验** | 流程是否可以更简化？是否有更直观的交互方式？ |
| **性能优化** | 是否有预加载、缓存、懒加载机会？ |
| **可观测性** | 日志、监控、告警策略是否完备？ |
| **扩展性** | 未来功能扩展是否预留了插槽？ |
| **成本优化** | 是否可以减少 API 调用、存储或计算资源？ |
| **无障碍** | 是否考虑了 a11y（如果涉及前端）？ |
| **国际化** | 是否需要 i18n 预留（如果面向多语言用户）？ |

**产出**：改进项列表，每条包含：
- 优先级：P0（强烈建议）/ P1（建议）/ P2（可选）
- 位置：PRD 相关章节
- 描述：改进内容
- 价值：带来的好处
- 实现成本：简要评估（低 / 中 / 高）

### 1.4 审查报告落盘

将审查结果保存到 `.omni-wf/prd-audits/AUDIT-NNN-{short-title}.md`：

```markdown
# AUDIT-NNN-{short-title}

## PRD Under Review
- File: docs/prds/NNN-{short-title}.md
- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Completeness Score: X/10

### Missing Sections
- [ ] ...

## Bug / Risk Findings

### CRITICAL
1. ...

### HIGH
1. ...

### MEDIUM
1. ...

### LOW
1. ...

## Improvement Opportunities

### P0
1. ...

### P1
1. ...

### P2
1. ...

## Overall Verdict
[PRD 总体评价：可直接拆分 / 需修复后拆分 / 需重大修订]
```

---

## Phase 2: 用户决策 — 修复范围选择

**目标**：基于审查报告，让用户明确选择后续修复范围。

### 2.1 展示审查摘要

向用户展示结构化摘要：

```
=== PRD 审查摘要 ===

完整性评分：X/10
Bug/风险：N 条（CRITICAL: a, HIGH: b, MEDIUM: c, LOW: d）
改进空间：N 条（P0: a, P1: b, P2: c）

总体结论：[可直接拆分 / 需修复后拆分 / 需重大修订]
```

### 2.2 用户选择

**必须询问用户，不得默认选择。**

```
请选择修复范围：

A. 【保守】仅修复优先级 Bug（CRITICAL + HIGH）
   → 忽略 MEDIUM/LOW Bug 和所有改进项，只确保 PRD 逻辑正确、无严重风险

B. 【标准】修复所有 Bug（CRITICAL + HIGH + MEDIUM + LOW）
   → 确保 PRD 无已知风险，但暂不采纳改进建议

C. 【积极】修复所有 Bug 并同时实现 P0 改进项
   → 在修正风险的同时，引入高价值优化

D. 【全面】修复所有 Bug 并实现 P0 + P1 改进项
   → 最大化 PRD 质量，可能增加构建工作量

你的选择：
```

### 2.3 记录用户决策

将用户选择记录到审查报告尾部：

```markdown
## User Choice
- Selected Option: [A / B / C / D]
- Date: ...
- Rationale: [用户补充的理由，如有]
```

同时记录到 state.md Notes：

```markdown
## Notes
- prd-audit: AUDIT-NNN completed. User chose Option [X]. Bug fixes: [Y]. Improvements: [Z].
```

---

## Phase 3: PRD 修正（条件执行）

**目标**：根据用户选择的修复范围，更新 PRD 文件。

### 3.1 确定修正内容

| 用户选择 | 修正内容 |
|---------|---------|
| A | 仅修复 CRITICAL + HIGH Bug/风险 |
| B | 修复所有 Bug/风险（CRITICAL/HIGH/MEDIUM/LOW） |
| C | 修复所有 Bug + 实现 P0 改进项 |
| D | 修复所有 Bug + 实现 P0 + P1 改进项 |

### 3.2 执行修正

- 直接编辑 `docs/prds/NNN-{short-title}.md`
- 保留原始内容结构，补充缺失章节、修正矛盾描述、添加边界条件说明
- 若引入重大变更，在 PRD 底部增加 `## Changelog` 记录：

```markdown
## Changelog
- $(date): [prd-audit] 修正 ...（原因：...）
```

### 3.3 修正后快照

保存修正后的 PRD 副本到 `.omni-wf/prd-audits/AUDIT-NNN-{short-title}-revised.md`，作为审计追踪。

---

## Phase 4: Issue 拆分

**目标**：将审查通过后的 PRD 拆分为垂直切片 Issue。

### 4.1 调用 to-issues

运行 matt-skills `/to-issues`：
- 输入：修正后的 PRD（`docs/prds/NNN-{short-title}.md`）
- 输出：垂直切片 Issue 列表

**执行规则**：
- 遵循 `/to-issues` 的 tracer-bullet 原则（端到端垂直切片）
- 若用户选择了改进项（Option C/D），确保改进项被分配到相应切片
- 优先 AFK 切片，必要时标记 HITL

### 4.2 创建 GitHub Issues

通过 `gh issue create` 发布每个切片，标签必须包含 `omni-wf`。

Issue body 模板（在标准 to-issues 模板基础上增加）：

```markdown
## Parent PRD
docs/prds/NNN-{short-title}.md

## PRD Audit
- Audit Report: .omni-wf/prd-audits/AUDIT-NNN-{short-title}.md
- User Choice: Option [X]

## Related Decisions
（如有审查中产生的决策，列出）
```

### 4.3 记录 Issue 列表

将所有 Issue 编号记录到 state.md：

```markdown
## GitHub Issues
- #42 — [标题] — open
- #43 — [标题] — open
```

---

## Phase 5: 接入 omni-wf

**目标**：初始化 omni-wf state.md，标记 INCEPTION 已完成，进入 CONSTRUCTION。

### 5.1 初始化/更新 state.md

若 state.md 不存在，按 omni-wf 模板创建。然后更新：

```markdown
## Current Phase: CONSTRUCTION
## Current Stage: 2.1 Issue Split
## Branch: $_BRANCH
## Last Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Completed Phases
- [x] INCEPTION (completed via prd-audit at: ...)
- [ ] CONSTRUCTION
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence

### INCEPTION Phase
- Completed At: [时间]
- Evidence: PRD audited via prd-audit. Audit report: .omni-wf/prd-audits/AUDIT-NNN-xxx.md. User choice: Option [X]. Issues created: #42, #43, #44.
- Sub-phases completed: PRD Load → Completeness Check → Bug/Risk Review → Improvement Review → User Choice → PRD Revision → Issue Split
- User Confirmation: Approved by user selection

### CONSTRUCTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Issues completed: [0 / total N]
- Per-Issue Review Status: [待记录]
- User Confirmation: [待确认]

## PRDs
- docs/prds/NNN-{short-title}.md — AUDITED

## GitHub Issues
- #42 — [标题] — open
- #43 — [标题] — open

## Notes
- prd-audit entry used. INCEPTION skipped (office-hours/ceo-review/eng-review/design-review not run).
```

### 5.2 启动 omni-wf CONSTRUCTION

向用户报告：

```
PRD 审查完成，Issue 已创建。

当前状态：
- Phase: CONSTRUCTION
- Stage: 2.2 Context Management & Subagent Execution
- Issues: #42, #43, #44 (open)

接下来将按照 omni-wf 规范执行：
1. Per-Issue TDD (/tdd)
2. Per-Issue Review (/review)
3. Per-Issue QA (/qa，若涉及前端)
4. Per-Issue Test
5. 关闭 Issue

所有后续阶段强制继承 omni-wf 的执行约束。
```

**调用 omni-wf**：在提示词层面继续执行 omni-wf Phase 2 (CONSTRUCTION) 的规范，从 2.2 开始。

---

## 与 omni-wf 的衔接规范

| prd-audit 产出 | omni-wf 消费点 |
|---------------|--------------|
| `docs/prds/NNN-xxx.md` | CONSTRUCTION 2.1 的 PRD 输入 |
| `.omni-wf/prd-audits/AUDIT-NNN-xxx.md` | state.md Notes 引用 |
| GitHub Issues (omni-wf label) | CONSTRUCTION 2.2-2.8 的执行对象 |
| state.md (INCEPTION 标记完成) | CONSTRUCTION 阶段转换门检查 |

**关键规则**：
- prd-audit 完成后，Agent 不得在 CONSTRUCTION 中重新启动 INCEPTION 子阶段
- 若 CONSTRUCTION 中发现 PRD 有重大遗漏，记录到 state.md Notes，由用户决定是否回退到 prd-audit 重新审查
- 所有 review/QA/test 规则、subagent 委托规则、证据记录规则，**完全沿用 omni-wf 文档**

---

## 错误恢复

| 场景 | 恢复策略 |
|------|---------|
| PRD 文件不存在 | 提示用户确认路径，或降级为让用户直接粘贴内容 |
| GitHub Issue 获取失败 | 降级为本地 Issue 文件（临时保存），记录原因到 state.md |
| to-issues 失败 | 记录失败原因到 state.md，降级为本地 Issue 文件（`docs/issues/`)，待修复后迁移到 GitHub |
| 用户选择"需重大修订" | 暂停 Issue 拆分，将 PRD 返回给用户手动修订，修订后重新触发 `/prd-audit` |
| omni-wf 未安装 | 提示用户运行 `./setup` 安装 omni-wf，不得跳过接入步骤 |
| 审查时发现 PRD 严重不合格 | 产出审查报告后暂停，向用户明确说明问题严重性，等待用户决策 |
