# Omni Workflow (omni-wf)

**通用自主开发工作流编排器。**

将 Think → Plan → PRD → Issues → TDD-Build → Test → Ship 串联为一条自动化管道。
自动检测变更范围，路由到合适的评审技能，驱动现有 gstack / matt-skills 完成全流程开发。

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
2. 路由到合适的评审技能（/autoplan、/plan-eng-review 等）
3. 生成 PRD → 拆分 GitHub Issue → TDD 构建 → QA 验证 → 发布

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

Omni Workflow 本身不替代现有技能，而是编排它们。你需要先安装：

| 依赖 | 安装方式 | 用途 |
|------|---------|------|
| **gstack** | `cd gstack && ./setup` | 评审、QA、发布、部署、安全审计 |
| **matt-skills** | `cd matt-skills && ./scripts/link-skills.sh` | TDD、PRD 生成、Issue 拆分 |
| **gh CLI** | `brew install gh` / `apt install gh` | GitHub Issue 创建与管理 |

---

## 项目目录规范

Omni Workflow 要求项目使用以下文档目录结构：

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
│   └── state.md              # 工作流状态（阶段/进度/待决策）
│
└── GitHub Issues             # Issue 垂直切片（通过 gh CLI 管理，带 omni-wf label）
```

### 命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| PRD | `NNN-{short-title}.md` | `001-auth-system.md` |
| Decision | `DECISION-NNN-{short-title}.md` | `DECISION-001-use-jwt.md` |
| ADR | `ADR-NNN-{short-title}.md` | `ADR-001-cache-strategy.md` |
| Spec | `SPEC-NNN-{short-title}.md` | `SPEC-001-oauth-db-design.md` |

- `NNN`: 3 位零填充序号，递增
- `short-title`: 小写，kebab-case，不含日期

---

## 工作流管道

```
┌──────────────────────────────────────────────────────────────────────┐
│ THINK → PLAN → ISSUES → BUILD → TEST → SHIP                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  THINK   范围检测 → 路由评审 (/autoplan /plan-eng-review ...)        │
│  PLAN    需求细化 → PRD 生成 (/to-prd) → 保存到 docs/prds/          │
│  ISSUES  垂直切片 → GitHub Issue 创建 (gh issue create --label omni-wf)
│  BUILD   逐 Issue TDD 编码 (/tdd) → gh issue close #NNN             │
│  TEST    项目测试 + 浏览器验证 + 设计审计 (/qa /design-review)       │
│  SHIP    预合并评审 + 版本 bump + PR + 部署 (/ship /land-and-deploy)  │
│                                                                      │
│  每阶段: state.md 更新 + 决策落盘 + 决策索引维护                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 范围自动路由

| 文件数 | 类型 | 评审路由 |
|--------|------|---------|
| >20 | 宏大变更 | `/autoplan`（CEO→Design→Eng→DX） |
| 5-20 | 功能级 | `/plan-eng-review` + 条件叠加 |
| <5 | 增量 | 跳过评审，直接 BUILD |
| Bug | 缺陷修复 | `/investigate` → BUILD |
| 含前端文件 | 有 UI | 叠加 `/plan-design-review` + `/design-review` |
| 含安全相关 | 安全敏感 | 叠加 `/cso` |
| 含 API/路由 | 对外接口 | 叠加 `/plan-devex-review` |

---

## 状态管理

工作流状态保存在项目根目录的 `.omni-wf/state.md`：

```markdown
# Omni Workflow State

## Current Phase: [IDLE | THINK | PLAN | ISSUES | BUILD | TEST | SHIP]
## Current Stage: [具体阶段名]
## Branch: [分支名]
## Started At: [ISO8601]
## Last Updated: [ISO8601]

## Completed Phases
- [x] THINK
- [x] PLAN
- [ ] BUILD
- [ ] TEST
- [ ] SHIP

## PRDs
- docs/prds/001-auth-system.md — approved

## GitHub Issues
- #42 — [标题] — open
- #43 — [标题] — closed

## Pending Decisions
- [DECISION-001] 使用 JWT — 等待确认

## Notes
```

支持断点续作：工作流可随时中断，下次 `/omni-wf` 会从上次位置继续。

---

## MCP Server 工具列表

| 工具 | 说明 |
|------|------|
| `get_workflow_status` | 读取当前工作流结构化状态 |
| `list_prds` | 列出所有 PRD (docs/prds/) |
| `get_prd` | 读取指定 PRD |
| `list_decisions` | 列出所有决策记录 (docs/decisions/) |
| `get_decision` | 读取指定决策 |
| `log_decision` | 写入决策记录并自动更新索引 |
| `list_adrs` | 列出所有 ADR (docs/adr/) |
| `get_adr` | 读取指定 ADR |
| `list_specs` | 列出所有 Spec (docs/specs/) |
| `get_spec` | 读取指定 Spec |
| `list_gh_issues` | 列出带 omni-wf label 的 GitHub Issues |
| `close_gh_issue` | 关闭 GitHub Issue |
| `advance_phase` | 推进工作流到下一阶段 |

---

## 决策索引表

`docs/decisions/README.md` 由 AI 自动维护，格式：

```markdown
# 决策索引

## 活跃决策

| ID | 标题 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
| DECISION-001 | use-jwt | THINK | PENDING | 2026-05-22 | docs/prds/001-auth-system.md |

## 已归档决策

（无已归档决策）
```

每次生成新的 Decision 后，MCP Server 自动更新此索引表。

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
│   └── SKILL.md                ← 核心编排技能（提示词层）
├── mcp-server/
│   └── src/
│       └── server.ts           ← MCP Server（stdio，13 个工具）
├── bin/
│   └── omni-wf-state           ← 状态管理 CLI 辅助
└── docs/
    └── workflow-guide.md       ← 工作流详细指南
```

---

## 与 v3.1 架构的关系

Omni Workflow 是 v3.1 架构的**首个实现**：

- **共享运行时 = AI 代理本身**：工作流是提示词管道，不是代码管道
- **融合在提示词层**：不硬编码 gstack/matt 的 API，而是按名称调用它们的 SKILL.md
- **利用已有能力**：不重复造轮子，复用现有技能的专业能力
- **文档即状态**：PRD、Decision、ADR 全部保存在 docs/ 目录，可审计、可追溯
- **Issue 在 GitHub**：利用 GitHub 原生 Issue 跟踪，不用本地文件

---

## License

MIT
