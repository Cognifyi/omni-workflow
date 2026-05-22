# Omni Workflow (omni-wf)

**通用自主开发工作流编排器。**

将 Think → Plan → PRD → Issues → TDD-Build → Test → Ship 串联为一条自动化管道。
自动检测变更范围，路由到合适的评审技能，驱动现有 gstack / matt-skills 完成全流程开发。

**核心约束：所有阶段和步骤都是强制的。严禁跳过、简化或主观修改。**

---

## 执行约束（CRITICAL）

Agent 加载本技能后必须遵守以下约束：

### 禁止行为

| 禁止项 | 说明 |
|--------|------|
| 跳过阶段 | 不得以"学习项目"、"足够简单"等理由跳过任何阶段 |
| 跳过步骤 | 阶段内每个步骤必须完整执行 |
| 提前进入下一阶段 | 当前阶段未提供可验证证据前，不得进入下一阶段 |
| 替换 skill 调用 | 不得以其他操作替代文档要求的 `/skill-name` |
| 主观判断替代规则 | 不得以个人判断覆盖文档中的路由规则 |

### 强制要求

| 要求 | 说明 |
|------|------|
| 完整执行 | 每个阶段必须执行文档中列出的**所有**步骤 |
| 证据记录 | 每个阶段完成后必须在 state.md 中记录可验证的完成证据 |
| 用户确认 | 每个阶段转换必须通过 AskUserQuestion 获得用户明确批准 |
| 违规即停 | 发现偏差必须立即停止，向用户报告，等待指示 |
| 条件即执行 | 文档中标注"若 XXX > 0，必须 XXX"的条件，一旦触发必须执行 |

### 违规处理协议

```
发现违规 → 立即停止工作流
         → 向用户报告具体违规行为
         → 等待用户明确指示
         → 不得自行"修复"或"调整"后继续
```

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
3. 生成 PRD → 拆分 GitHub Issue → TDD 构建 → 代码审查 + QA → 发布

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
└── GitHub Issues             # Issue 垂直切片（omni-wf label）
```

### 命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| PRD | `NNN-{short-title}.md` | `001-auth-system.md` |
| Decision | `DECISION-NNN-{short-title}.md` | `DECISION-001-use-jwt.md` |
| ADR | `ADR-NNN-{short-title}.md` | `ADR-001-cache-strategy.md` |
| Spec | `SPEC-NNN-{short-title}.md` | `SPEC-001-oauth-db-design.md` |
| Review | `issue-NNN.md` | `issue-001.md` |

---

## 工作流管道

```
┌──────────────────────────────────────────────────────────────────────┐
│ THINK → PLAN → ISSUES → BUILD → TEST → SHIP                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  阶段转换门: 每个 → 前必须通过验证清单 + 用户确认                      │
│  违规处理: 发现跳过/遗漏 → 立即停止 → 报告用户 → 等待指示            │
│                                                                      │
│  THINK   范围检测 → 路由评审 (/autoplan /plan-eng-review ...)        │
│  PLAN    需求细化 → PRD 生成 (/to-prd) → 保存到 docs/prds/           │
│  ISSUES  垂直切片 → GitHub Issue 创建 (gh issue create --label omni-wf)
│  BUILD   逐 Issue TDD 编码 (/tdd)                                     │
│           → 每个 Issue 完成后必须 /review + (前端则 /qa) + 测试       │
│           → review 记录保存到 .omni-wf/reviews/issue-NNN.md           │
│           → 全部通过后 gh issue close #NNN                            │
│  TEST    项目测试 + 浏览器验证 + 设计审计 (/qa /design-review)         │
│  SHIP    预合并评审 + 版本 bump + PR + 部署 (/ship /land-and-deploy)  │
│                                                                      │
│  每阶段: state.md 更新 + 决策落盘 + 决策索引维护 + 完成证据记录        │
└──────────────────────────────────────────────────────────────────────┘
```

### 范围自动路由

| 文件数 | 类型 | 必须执行的评审 |
|--------|------|-------------|
| >20 | 宏大变更 | `/autoplan`（CEO→Design→Eng→DX） |
| 5-20 | 功能级 | `/plan-eng-review` + 条件叠加 |
| <5 | 增量 | 跳过 THINK，直接 PLAN |
| Bug | 缺陷修复 | `/investigate` → PLAN |
| 含前端文件 | 有 UI | **必须**叠加 `/plan-design-review` + `/design-review` |
| 含安全相关 | 安全敏感 | **必须**叠加 `/cso` |
| 含 API/路由 | 对外接口 | **必须**叠加 `/plan-devex-review` |

---

## BUILD 阶段强制审查

每个 GitHub Issue 完成后，**必须**按顺序执行：

1. **`/review`** — 代码审查（9 项检查清单）
   - 发现问题必须修复后重新 review
   - 输出保存到 `.omni-wf/reviews/issue-NNN.md`

2. **`/qa`** — 前端 Issue 必须执行
   - 发现 bug 必须修复后重新 QA
   - 报告追加到 `.omni-wf/reviews/issue-NNN.md`

3. **项目测试套件** — 必须全部通过
   - 失败 → `/investigate` → 修复 → 重新测试

4. **关闭 Issue** — 只有以上全部通过后才能执行
   - `gh issue close NNN --comment "Completed. Review: PASS. QA: [PASS/N/A]. Tests: PASS."`

---

## 状态管理

工作流状态保存在 `.omni-wf/state.md`。关键字段：

```markdown
## Current Phase: [IDLE | THINK | PLAN | ISSUES | BUILD | TEST | SHIP]

## Completed Phases
- [x] THINK (completed at: ...)
- [x] PLAN (completed at: ...)

## Phase Completion Evidence

### THINK Phase
- Completed At: 2026-05-22T10:00:00Z
- Evidence: 5 files changed, routing: /plan-eng-review + /cso, decisions: DECISION-001
- User Confirmation: Approved via AskUserQuestion
```

支持断点续作：工作流可随时中断，下次 `/omni-wf` 会从上次位置继续。

---

## MCP Server 工具列表

| 工具 | 说明 |
|------|------|
| `get_workflow_status` | 读取当前工作流状态（含 review 统计） |
| `list_prds` | 列出所有 PRD |
| `get_prd` | 读取指定 PRD |
| `list_decisions` | 列出所有决策 |
| `get_decision` | 读取指定决策 |
| `log_decision` | 写入决策并自动更新索引 |
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

## 决策索引表

`docs/decisions/README.md` 由 AI 自动维护：

```markdown
# 决策索引

## 活跃决策

| ID | 标题 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
| DECISION-001 | use-jwt | THINK | PENDING | 2026-05-22 | docs/prds/001-auth-system.md |
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
