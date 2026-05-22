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

这会创建符号链接到 `~/.claude/skills/omni-wf/`（及 Codex、OpenCode、Factory 等路径）。

### 2. 在 Claude Code 中启动工作流

```
/omni-wf
```

Claude 会自动：
1. 检测当前分支的变更范围
2. 路由到合适的评审技能（/autoplan、/plan-eng-review 等）
3. 生成 PRD → 拆分 Issue → TDD 构建 → QA 验证 → 发布

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

---

## 工作流管道

```
┌──────────────────────────────────────────────────────────────────────┐
│ THINK → PLAN → ISSUES → BUILD → TEST → SHIP                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  THINK   范围检测 → 路由评审 (/autoplan /plan-eng-review ...)        │
│  PLAN    需求细化 → PRD 生成 (/to-prd)                                │
│  ISSUES  垂直切片 → 本地 Issue 跟踪 (/to-issues)                      │
│  BUILD   逐 Issue TDD 编码 (/tdd)                                     │
│  TEST    项目测试 + 浏览器验证 + 设计审计 (/qa /design-review)       │
│  SHIP    预合并评审 + 版本 bump + PR + 部署 (/ship /land-and-deploy)  │
│                                                                      │
│  每阶段: state.md 更新 + 决策落盘                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 范围自动路由

| 文件数 | 类型 | 评审路由 |
|--------|------|---------|
| >20 | 宏大变更 | `/autoplan`（CEO→Design→Eng→DX） |
| 5-20 | 功能级 | `/plan-eng-review` + 按需叠加 |
| <5 | 增量 | 跳过评审，直接 BUILD |
| Bug | 缺陷修复 | `/investigate` → BUILD |
| 含前端文件 | 有 UI | 叠加 `/plan-design-review` + `/design-review` |
| 含安全相关 | 安全敏感 | 叠加 `/cso` |
| 含 API/路由 | 对外接口 | 叠加 `/plan-devex-review` |

---

## 状态管理

所有工作流状态保存在项目根目录的 `.omni-wf/` 中：

```
.omni-wf/
├── state.md          ← 工作流主状态（阶段、进度、待决策）
├── decisions/        ← 决策记录（DECISION-001.md ...）
├── prds/             ← PRD 文档（PRD-001.md ...）
└── issues/           ← 本地 Issue（ISSUE-001.md ...）
```

state.md 支持断点续作：工作流可随时中断，下次 `/omni-wf` 会从上次位置继续。

---

## MCP Server 工具列表

| 工具 | 说明 |
|------|------|
| `get_workflow_status` | 读取当前工作流结构化状态 |
| `list_prds` | 列出所有 PRD |
| `get_prd` | 读取指定 PRD |
| `list_issues` | 列出所有 Issue |
| `get_issue` | 读取指定 Issue |
| `update_issue_status` | 更新 Issue 状态（OPEN / IN_PROGRESS / DONE）|
| `log_decision` | 写入决策记录 |
| `list_decisions` | 列出所有决策 |
| `advance_phase` | 推进工作流到下一阶段 |

---

## 项目结构

```
omni-wf/
├── README.md
├── setup                     ← 安装脚本
├── package.json              ← MCP server 依赖
├── tsconfig.json             ← TypeScript 配置
├── omni-wf/
│   └── SKILL.md              ← 主工作流技能（提示词层）
├── mcp-server/
│   └── src/
│       └── server.ts         ← MCP Server（stdio 传输）
├── bin/
│   └── omni-wf-state         ← 状态管理 CLI 辅助工具
└── docs/
    └── workflow-guide.md     ← 工作流详细指南
```

---

## 与 v3.1 架构的关系

Omni Workflow 是 v3.1 架构的**首个实现**：

- **共享运行时 = AI 代理本身**：工作流是提示词管道，不是代码管道
- **融合在提示词层**：不硬编码 gstack/matt 的 API，而是按名称调用它们的 SKILL.md
- **利用已有能力**：不重复造轮子，复用现有技能的专业能力
- **状态落盘**：`.omni-wf/` 目录提供持久化，支持跨会话恢复

---

## License

MIT
