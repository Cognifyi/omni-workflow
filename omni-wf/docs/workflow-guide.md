# Omni Workflow 详细指南

## 目录

1. [核心理念](#核心理念)
2. [Phase 详解](#phase-详解)
3. [状态管理规范](#状态管理规范)
4. [决策落盘规范](#决策落盘规范)
5. [错误恢复](#错误恢复)
6. [高级用法](#高级用法)

---

## 核心理念

Omni Workflow 的运行时就是 AI 代理本身。工作流是**提示词管道**，不是代码管道。

### 与 v3.0 的根本区别

| v3.0（错误） | v3.1 / Omni Workflow（正确） |
|-------------|----------------------------|
| TypeScript 代码硬链接 | 提示词层统一编排 |
| `SkillsKernel.execute()` | SKILL.md 引导 AI 代理 |
| 试图把技能当 API 调用 | 共享运行时 = AI 代理本身 |

### 为什么这样设计

1. **gstack** 是 Bun 编译的二进制 + Markdown 技能库，不是 Node.js 库
2. **matt-skills** 是 Markdown 提示词库，没有运行时 API
3. **aidlc-workflows** 是 Markdown 规则分发包，也没有运行时

试图用 TypeScript 硬链接调用它们是**范式错配**。正确的做法是在提示词层编排：告诉 AI "现在运行 /autoplan"，AI 会读取对应的 SKILL.md 并执行。

---

## Phase 详解

### Phase 0: 入口与状态恢复

每次启动 `/omni-wf` 时，技能会先读取 `.omni-wf/state.md`。

**场景 A: 全新工作流**
- state.md 不存在或用户选择"重新开始"
- 初始化 IDLE 状态
- 等待用户输入需求

**场景 B: 断点续作**
- state.md 存在且 `Current Phase != IDLE`
- 展示当前进度摘要
- 询问用户继续或重新开始

**场景 C: 被动触发**
- 用户说"帮我实现 XXX"
- 技能自动检测当前 git 状态
- 若有未提交的变更，从 THINK 开始
- 若无变更，从 PLAN 开始（假设已有明确需求）

### Phase 1: THINK — 范围检测与评审路由

这是整个工作流的"大脑"，决定后续所有行动。

#### 范围检测逻辑

```bash
git diff --stat HEAD          # 文件数量
git diff --name-only HEAD     # 文件类型特征
```

特征提取：
- `\.(tsx|jsx|css|vue|svelte|html)$` → 前端变更
- `(auth|oauth|jwt|secret|token|password|crypto)` → 安全敏感
- `(route|api|endpoint|graphql|grpc)` → 对外接口
- `(schema|migration|sql|model|prisma|sequelize)` → 数据层

#### 评审路由决策

| 条件 | 路由 |
|------|------|
| 文件数 > 20 | `/autoplan`（完整四阶段 CEO→Design→Eng→DX） |
| 文件数 5-20 | `/plan-eng-review` + 条件叠加 |
| 文件数 < 5 | 跳过 THINK，直接 BUILD |
| 用户明确说 "Bug" / "fix" / "broken" | `/investigate` → BUILD |

条件叠加：
- 有前端文件 → 叠加 `/plan-design-review`
- 有安全特征 → 叠加 `/cso`
- 有 API 特征 → 叠加 `/plan-devex-review`

#### THINK 输出

必须落盘的决策：
1. **范围分类**：宏大 / 功能 / 增量 / Bug
2. **评审路由**：具体调用了哪些技能
3. **关键风险**：至少识别 2 个风险点
4. **推荐路径**：建议的实现策略

### Phase 2: PLAN — PRD 生成

#### 输入
- THINK 阶段的评审结论
- 用户原始需求
- 项目上下文（CLAUDE.md、CONTEXT.md、docs/adr/）

#### 输出
- `.omni-wf/prds/PRD-NNN.md`
- state.md 中 PRDs 列表更新

#### PRD 格式

遵循 matt-skills `to-prd` 的标准模板：
- Problem Statement
- Solution
- User Stories（必须详尽）
- Implementation Decisions
- Testing Decisions
- Out of Scope
- Further Notes

### Phase 3: ISSUES — 垂直切片拆分

#### 核心规则：垂直切片

**正确**（垂直）：
```
ISSUE-001: 用户可以创建账户（端到端：API + DB + UI + 测试）
ISSUE-002: 用户可以登录（端到端：API + DB + UI + 测试）
```

**错误**（水平）：
```
ISSUE-001: 实现数据库 schema
ISSUE-002: 实现 API 路由
ISSUE-003: 实现前端页面
```

#### HITL vs AFK

- **HITL**：需要人类决策（架构选择、设计评审、外部依赖确认）
- **AFK**：代理可以独立完成（编码、测试、重构）

优先将 slice 标记为 AFK，除非明确需要人类输入。

#### 依赖管理

每个 Issue 文件包含 `Blocked by` 字段：
- 引用其他本地 Issue ID（如 `ISSUE-001`）
- 或 `None - can start immediately`

BUILD 阶段按拓扑排序执行（先执行无依赖的，再执行依赖已完成的）。

### Phase 4: BUILD — TDD 逐 Issue 编码

#### 执行策略

1. 从 state.md 的 Issues 列表中找出所有 blocker 已完成的 OPEN Issue
2. 选择第一个（按创建顺序）
3. 读取 Issue 内容
4. 调用 `/tdd`（matt-skills）
5. TDD 完成后，运行项目测试
6. 测试通过 → 标记 Issue 为 DONE → 下一个 Issue
7. 测试失败 → `/investigate` → 修复 → 重新测试

#### TDD 规则（来自 matt-skills）

- 一次只写一个测试
- 只写足够通过当前测试的代码
- 绝不猜测未来需求
- 重构必须在 GREEN 状态
- 垂直切片：test1→impl1 → test2→impl2，不是 test1,2,3 → impl1,2,3

### Phase 5: TEST — 多层验证

#### 验证层次

1. **项目级测试**：`npm test` / `bun test` / 项目特定命令
2. **浏览器验证**（条件）：gstack `$B` 截图
3. **QA 测试**（条件）：`/qa` Quick/Standard/Exhaustive
4. **设计审计**（条件）：`/design-review`
5. **安全审计**（条件）：`/cso`

#### 测试失败处理

```
失败 → /investigate（6 阶段根因分析）
     → 修复
     → 回归测试
     → 通过 → 继续
     → 仍失败 → 升级：询问用户 / context-save / 跳过
```

### Phase 6: SHIP — 预合并评审与发布

#### 预合并评审 `/review`

5 大安全项：
1. SQL & 数据安全 — SQL 注入、数据泄露路径
2. 竞态条件 & 并发 — 共享状态、原子操作
3. LLM 信任边界 — LLM 输出写入 DB 前验证
4. Shell 注入 — exec/spawn 中用户输入引号包裹
5. 枚举完整性 — 新枚举值在所有 switch 处理

4 信息项：
- 异步/同步混合
- 类型安全
- 前端可访问性
- 超时安全

#### 发布流程

```
/review（预合并评审）
  ↓
/benchmark（性能基线，条件触发）
  ↓
/ship（版本 bump + CHANGELOG + PR）
  ↓
/land-and-deploy（合并 + CI + 部署）
  ↓
/canary（金丝雀监控）
  ↓
DONE
```

---

## 状态管理规范

### state.md 字段语义

| 字段 | 说明 | 可取值 |
|------|------|--------|
| `Current Phase` | 当前大阶段 | IDLE, THINK, PLAN, ISSUES, BUILD, TEST, SHIP |
| `Current Stage` | 当前子阶段 | 各阶段内部的具体状态 |
| `Branch` | 工作流开始时的分支 | git branch 输出 |
| `Started At` | 工作流启动时间 | ISO8601 |
| `Last Updated` | 最后更新时间 | ISO8601 |
| `Completed Phases` | 已完成阶段 | 复选框列表 |
| `Pending Decisions` | 等待用户确认的决策 | 列表 |
| `PRDs` | PRD 清单 | 列表 |
| `Issues` | Issue 清单及状态 | 列表 |
| `Notes` | 任意备注 | 自由文本 |

### 阶段转换矩阵

```
IDLE ──(start)──→ THINK
THINK ──(review done)──→ PLAN
PLAN ──(prd approved)──→ ISSUES
ISSUES ──(issues ready)──→ BUILD
BUILD ──(all issues done)──→ TEST
TEST ──(qa passed)──→ SHIP
SHIP ──(deployed)──→ DONE
```

### 断点续作规则

当 `Current Phase` 不为 IDLE 时：
1. 读取 `Current Stage`
2. 若 `Current Stage` 以 `-in-progress` 结尾，从该子阶段的开始恢复
3. 若 `Current Stage` 以 `-complete` 结尾，进入下一阶段

---

## 决策落盘规范

### 何时落盘

每个大阶段（THINK、PLAN、BUILD、TEST、SHIP）结束时必须落盘至少一个决策。

### 决策文件格式

```markdown
# Decision: DECISION-NNN

## Phase: [阶段名]
## Date: [ISO8601]
## Status: [PENDING | APPROVED | REJECTED]

## Context
[为什么需要做这个决策]

## Options Considered
1. [选项A] — [理由]
2. [选项B] — [理由]

## Decision
[最终选择了什么]

## Consequences
[正面影响]
[负面影响]
[风险]
```

### 决策状态流转

```
PENDING ──(用户确认)──→ APPROVED
     └────(用户否决)──→ REJECTED
```

### 与 state.md 的关联

state.md 的 `Pending Decisions` 字段只记录标题和摘要，详细内容在 `decisions/` 目录中。

---

## 错误恢复

### 常见错误场景

| 场景 | 恢复策略 |
|------|---------|
| 子技能失败 | state.md 记录失败原因 → 询问用户重试/跳过/调整 |
| 测试失败 | `/investigate` → 修复 → 回归测试 |
| 用户打断 | 保存 state.md → 标记 INTERRUPTED → 支持 context-save |
| 依赖缺失（gstack/matt 未安装） | 询问用户安装，或跳过该阶段 |
| 无 git 仓库 | 降级为纯文档工作流，跳过 git 相关阶段 |
| 测试命令未知 | 读取 CLAUDE.md → 询问用户 → 落盘到 CLAUDE.md |
| 合并冲突 | 暂停 → 询问用户手动解决 → 恢复 |

### 升级路径

当错误无法自动恢复时：

1. **第一次失败**：自动重试（如 `/investigate` 后再运行测试）
2. **第二次失败**：询问用户是否调整方案
3. **第三次失败**：建议 `/context-save` 保存状态，让用户手动处理

---

## 高级用法

### 自定义测试命令

在项目根目录的 `CLAUDE.md` 中添加：

```markdown
## Test Commands
- Unit tests: `bun test`
- E2E tests: `bun run test:e2e`
- Lint: `bun run lint`
```

Omni Workflow 会优先读取这些命令。

### 与 CI/CD 集成

`.omni-wf/` 目录可以加入 `.gitignore`（不提交），也可以提交到仓库（作为开发轨迹记录）。

如果提交到仓库：
- PR 中可以看到完整的设计决策轨迹
- Code Review 时可以参考 `decisions/` 目录
- 便于审计和复盘

### 多分支并行

每个分支有自己的 `.omni-wf/` 目录。切换分支时工作流状态自动隔离。

### 连续检查点模式

若启用了 gstack 的 continuous checkpoint 模式：
- 每完成一个 Issue，自动 `WIP:` commit
- 工作流失败时可以从最后一个 commit 恢复

---

## 扩展开发

### 添加新的 Phase

1. 在 `SKILL.md` 中添加新 Phase 的说明
2. 在 state.md 的 `Completed Phases` 中添加新复选框
3. 在 MCP Server 的 `advance_phase` 工具的 enum 中添加新阶段
4. 更新路由逻辑

### 添加新的子技能调用

在对应 Phase 中，按 gstack/matt-skills 的命名约定调用：

```markdown
运行 `/new-skill-name`（说明来源和用途）
```

Omni Workflow 不硬编码技能的具体行为，只负责编排调用顺序。
