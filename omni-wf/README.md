# Omni Workflow (omni-wf) v0.2.0

**通用自主开发工作流编排器。**

对齐 gstack / matt-skills / aidlc-workflows 三大体系，将 INCEPTION → CONSTRUCTION → TEST → SHIP 串联为一条自动化管道。

**核心约束：所有阶段和子阶段都是强制的。严禁跳过、简化或主观修改。**

---

## 执行约束（CRITICAL）

Agent 加载本技能后必须遵守：

| 禁止项 | 说明 |
|--------|------|
| 跳过阶段 | 不得以任何理由跳过 INCEPTION / CONSTRUCTION / TEST / SHIP |
| 跳过子阶段 | 不得跳过 INCEPTION 中的 5 个子阶段 |
| 提前进入下一阶段 | 当前阶段未提供可验证证据前，不得进入下一阶段 |
| 替换 skill 调用 | 不得以其他操作替代文档中明确要求的 `/skill-name` |
| 主观判断替代规则 | 不得以"学习项目"、"足够简单"等理由覆盖路由规则 |

| 强制要求 | 说明 |
|------|------|
| 完整执行 | 每个子阶段必须执行文档中列出的**所有**步骤 |
| 产出物落盘 | 每个子阶段必须有明确的产出物（文档/记录/编号） |
| 证据记录 | 每个阶段完成后必须在 state.md 中记录可验证的完成证据 |
| 用户确认 | 每个阶段转换必须通过 AskUserQuestion 获得用户明确批准 |
| 违规即停 | 发现任何偏差必须立即停止工作流，向用户报告，等待指示 |

---

## 双形态支持

| 形态 | 说明 | 适用场景 |
|------|------|---------|
| **SKILL.md** | AI 代理读取执行的提示词技能 | Claude Code / OpenCode 中直接加载 |
| **MCP Server** | 通过工具调用驱动工作流 | Claude Desktop / 任何 MCP 客户端 |

---

## 快速开始

### 1. 安装技能

```bash
cd omni-wf
./setup
```

这会创建符号链接到：
- `~/.claude/skills/omni-wf/`（Claude Code）
- `~/.agents/skills/omni-wf/`（Devin / 通用 agent）
- `~/.config/opencode/skills/omni-wf/`（OpenCode）
- `~/.codex/skills/omni-wf/`（Codex）
- `~/.factory/skills/omni-wf/`（Factory）

### 2. 在 Claude Code 中启动工作流

```
/omni-wf
```

Claude 会自动：
1. 检测当前分支的变更范围
2. 按 INCEPTION → CONSTRUCTION → TEST → SHIP 顺序执行
3. 每个子阶段调用对应的专业 skill，产出文档，记录证据
4. 每个阶段转换前通过 AskUserQuestion 获得用户确认

### 3.（可选）安装 MCP Server

```bash
./setup --mcp
```

然后在 Claude Desktop 配置中添加：

```json
{
  "mcpServers": {
    "omni-wf": {
      "command": "bun",
      "args": ["/path/to/omni-wf/mcp-server/src/server.ts"]
    }
  }
}
```

---

## 前置依赖

| 依赖 | 安装方式 | 用途 |
|------|---------|------|
| **gstack** | `cd gstack && ./setup` | 评审、QA、发布、部署、安全审计 |
| **matt-skills** | `cd matt-skills && ./scripts/link-skills.sh` | TDD、PRD 生成、Issue 拆分 |
| **gh CLI** | `brew install gh` / `apt install gh` | GitHub Issue 创建与管理 |

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

---

## 工作流管道

```
INCEPTION (需求明确 + 架构锁定)
  ├── 1.1 Office Hours      → /office-hours      → 产出: 需求验证决策
  ├── 1.2 CEO Review       → /plan-ceo-review   → 产出: 战略决策
  ├── 1.3 Eng Review       → /plan-eng-review   → 产出: 架构决策 + 数据流图 + 测试策略 + SPEC
  ├── 1.4 Design Review    → /plan-design-review → 产出: 设计决策 (条件: HAS_FRONTEND>0)
  └── 1.5 PRD Finalization  → /to-prd            → 产出: docs/prds/NNN-xxx.md

CONSTRUCTION (垂直切片编码)
  ├── 2.1 Issue Split      → /to-issues         → 产出: GitHub Issues (omni-wf label)
  ├── 2.2 Per-Issue TDD    → /tdd (含 aidlc construction 规范) → 产出: 代码 + 测试
  ├── 2.3 Per-Issue Review → /review            → 产出: .omni-wf/reviews/issue-NNN.md
  ├── 2.4 Per-Issue QA     → /qa                → 产出: QA 报告 (条件: 前端 Issue)
  └── 2.5 Per-Issue Test   → npm test           → 产出: 测试通过记录

TEST (系统集成验证)
  ├── 3.1 Integration Tests
  ├── 3.2 Browser Validation (条件: HAS_FRONTEND>0)
  ├── 3.3 Design Audit     (条件: HAS_FRONTEND>0)
  ├── 3.4 Security Audit   (条件: HAS_SECURITY>0)
  └── 3.5 Bug Investigation (条件: 发现 Bug)

SHIP (发布部署)
  ├── 4.1 Pre-merge Review
  ├── 4.2 Performance Baseline (条件: HAS_FRONTEND>0)
  ├── 4.3 Release          → /ship
  ├── 4.4 Deploy           → /land-and-deploy
  └── 4.5 Canary           → /canary
```

### 与三大体系的映射

| omni-wf | gstack | matt-skills | aidlc-workflows |
|---------|--------|-------------|-----------------|
| INCEPTION | `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review` | `/to-prd` | inception |
| CONSTRUCTION | `/tdd` + `/review` + `/qa` | `/tdd` + `/to-issues` | construction |
| TEST | `/qa` + `/design-review` + `/cso` + `/investigate` | — | construction (nfr) |
| SHIP | `/review` + `/benchmark` + `/ship` + `/land-and-deploy` + `/canary` | — | operations |

---

## INCEPTION 阶段详解

INCEPTION 的 5 个子阶段必须按顺序执行。每个子阶段都有明确的产出物。

### 1.1 Office Hours — 需求验证

**调用**：`/office-hours`

**产出物**：
- `docs/decisions/DECISION-NNN-office-hours-{title}.md`

### 1.2 CEO Review — 战略评审

**调用**：`/plan-ceo-review`

**产出物**：
- `docs/decisions/DECISION-NNN-ceo-review-{title}.md`

### 1.3 Eng Review — 架构评审

**调用**：`/plan-eng-review`

**产出物**：
- `docs/decisions/DECISION-NNN-eng-review-{title}.md`
- `docs/specs/SPEC-NNN-{title}.md`

### 1.4 Design Review — 设计评审

**调用**：`/plan-design-review`
**条件**：`HAS_FRONTEND > 0` 时必须执行

**产出物**：
- `docs/decisions/DECISION-NNN-design-review-{title}.md`

### 1.5 PRD Finalization — PRD 生成

**调用**：`/to-prd`

**产出物**：
- `docs/prds/NNN-{title}.md`

---

## CONSTRUCTION 阶段详解

### 2.2 Per-Issue TDD — 引入 aidlc construction 规范

在 matt-skills `/tdd` 的基础上，引入 aidlc-workflows construction 规范：

- **Planning**：检查 NFR 需求（性能、安全、可扩展性）
- **Tracer Bullet**：RED→GREEN 验证端到端路径
- **Incremental Loop**：逐个测试→实现，垂直切片
- **Refactor**：GREEN 状态下重构，引入 aidlc 代码生成规范

### 2.3 Per-Issue Review — 强制代码审查

每个 Issue 完成后**必须**执行 `/review`（9 项检查清单）：
1. SQL & 数据安全
2. 竞态条件 & 并发
3. LLM 信任边界
4. Shell 注入
5. 枚举完整性
6. 异步/同步混合
7. 类型安全
8. 前端可访问性
9. 超时安全

发现问题必须修复后重新 review。输出保存到 `.omni-wf/reviews/issue-NNN.md`。

---

## MCP Server 工具列表

| 工具 | 说明 |
|------|------|
| `get_workflow_status` | 读取当前工作流状态（含 review 统计） |
| `list_prds` | 列出所有 PRD |
| `get_prd` | 读取指定 PRD |
| `list_decisions` | 列出所有决策 |
| `get_decision` | 读取指定决策 |
| `log_decision` | 写入决策并自动更新索引（新增 sub_phase 字段） |
| `list_adrs` | 列出所有 ADR |
| `get_adr` | 读取指定 ADR |
| `list_specs` | 列出所有 Spec |
| `get_spec` | 读取指定 Spec |
| `list_gh_issues` | 列出 omni-wf label 的 GitHub Issues |
| `close_gh_issue` | 关闭 GitHub Issue |
| `log_review` | 写入 per-Issue review/QA/test 记录 |
| `list_reviews` | 列出所有 review 记录 |
| `get_review` | 读取指定 review 记录 |
| `validate_phase_transition` | 验证阶段是否可推进（检查 evidence、reviews） |
| `advance_phase` | 推进工作流（**必须**提供 evidence） |

---

## 状态管理

`.omni-wf/state.md` 示例：

```markdown
# Omni Workflow State

## Current Phase: CONSTRUCTION
## Current Stage: per-issue-tdd

## Completed Phases
- [x] INCEPTION
- [ ] CONSTRUCTION
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence

### INCEPTION Phase
- Completed At: 2026-05-22T12:00:00Z
- Evidence: 5 decisions logged, 2 specs created, 1 PRD finalized
- Sub-phases: office-hours, ceo-review, eng-review, design-review, prd-finalization
- User Confirmation: Approved via AskUserQuestion

### CONSTRUCTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Issues completed: 3 / 10
- Per-Issue Review Status:
  - #42 — review: PASS, qa: PASS, tests: PASS
  - #43 — review: PASS, qa: N/A, tests: PASS
```

---

## 项目结构

```
omni-wf/
├── README.md                   ← 本文件
├── setup                       ← 安装脚本
├── package.json                ← MCP Server 依赖
├── tsconfig.json               ← TypeScript 配置
├── .gitignore
├── .claude-plugin/plugin.json  ← matt-skills 兼容注册
├── omni-wf/
│   └── SKILL.md                ← 核心编排技能（含执行约束）
├── mcp-server/
│   └── src/
│       └── server.ts           ← MCP Server（stdio，17 个工具）
├── bin/
│   └── omni-wf-state           ← 状态管理 CLI（含 evidence 记录）
└── docs/
    └── workflow-guide.md       ← 工作流详细指南
```

---

## License

MIT
