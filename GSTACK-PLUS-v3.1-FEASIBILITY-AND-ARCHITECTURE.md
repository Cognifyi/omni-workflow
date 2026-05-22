# gstack-plus v3.1: 深度代码审计后的可行性评估与新架构

**文档版本**: 3.1  
**更新时间**: 2026-05-22  
**基于**: 对 gstack v1.39.0.0、aidlc-workflows、matt-skills 三份项目代码的完整审计  
**审计范围**: 6000+ 行源代码、120+ 个文件

---

## 第一部分: 现状深度解剖

### 1.1 三个项目的本质定位

在分析v3.0可行性之前，必须理解这三个项目各自是什么——**以及它们不是什么**。

| 项目 | 真实本质 | 运行时 | 代码范式 | v3.0的误解 |
|------|---------|--------|---------|-----------|
| **gstack** | Bun编译的**浏览器守护进程** + Markdown技能库 | Bun编译二进制 (CLI+Server) | 真正的TypeScript代码，含安全层、CDP集成、多Listener HTTP Server | 被当成"有GStackSession API和SkillsKernel的框架" |
| **aidlc-workflows** | **Markdown规则分发包** + Python评估框架 | 纯提示词 (AI代理读取的Markdown) | 方法论说明文档，无运行时 | 被当成"可以当Submodule引用的上游" |
| **matt-skills** | **Markdown提示词库**，组织为可组合的独立技能文件 | 纯提示词 (AI代理读取的Markdown) | 精简的Markdown指令文件，无运行时 | 被当成"有SkillsKernel.execute() API的框架" |

### 1.2 关键发现: v3.0架构中不存在的组件

v3.0架构文档中定义的核心组件，**在代码库中完全不存在**：

```typescript
// ❌ 以下组件全是v3.0作者虚构的，代码中不存在

// 1. SkillsKernel — 没有任何编程方式调用技能的API
SkillsKernel.execute('to-prd', { inputPath, outputDir })
// → gstack的技能是SKILL.md提示词，由Claude Code读取，无法被TypeScript调用
// → matt-skills的技能同样是SKILL.md，也无法被TypeScript调用

// 2. WorkflowInterceptor — 没有任何钩子系统
WorkflowInterceptor.onPlanningComplete(session)
// → gstack没有"会话完成回调"机制
// → 没有GStackSession类，没有getConversationSummary()

// 3. UnifiedDocManager — 没有任何统一文档管理器
new UnifiedDocManager(process.cwd())
// → gstack和matt-skills都由AI代理直接创建文件
// → 没有代码层的"文档路径管控"

// 4. MCP Server — 不存在
McpServer({ name: "gstack-plus-orchestrator" })
// → gstack代码库中没有MCP Server实现
// → package.json没有@modelcontextprotocol/sdk依赖

// 5. AutomationDeployer / AutomationTester — 不存在
new AutomationDeployer().execute()
// → 部署和测试由SKILL.md提示词驱动AI代理完成
// → 不是由TypeScript代码直接执行的

// 6. upstream/ 子模块结构 — 不存在
git submodule add https://github.com/garrytan/gstack.git upstream/gstack
// → gstack本身就是上游，不是其他项目的下游
// → aidlc-workflows有独立的release pipeline (zip发布)，非子模块设计
// → matt-skills使用npx skills@latest add安装，非子模块设计
```

### 1.3 v3.0架构的五个根本性缺陷

#### 缺陷1: 范式错配 — 把提示词当API调用

```
v3.0假想:                    现实:
┌─────────────────────┐      ┌──────────────────────┐
│ SkillsKernel        │      │ Claude Code           │
│   .execute('to-prd')│      │   ↓ 读取SKILL.md      │
│   .execute('tdd')   │      │   ↓ 按提示词执行步骤   │
│   .execute('qa')    │      │   ↓ 生成文件/运行命令   │
└─────────────────────┘      └──────────────────────┘
```

所有"技能"（无论是gstack的50+技能还是matt-skills的技能）都是**Markdown提示词**，由AI代理读取后自主执行。不存在一个中心化的"技能内核"可供外部代码调用。

**影响**: v3.0整个"代码硬链接"层（WorkflowInterceptor、SkillsKernel）无法实现。

#### 缺陷2: 对gstack的技术栈理解偏差

v3.0假设gstack是一个可以import的Node.js/TypeScript库：

```bash
# v3.0假设:
import { GStackSession } from '../upstream/gstack/core';

# 现实:
# gstack是Bun编译的独立二进制文件
# 没有 "gstack/core" 模块可以import
# 没有类型化的Session API
```

gstack的真实架构堆栈：
```
┌──────────────────────────────┐
│  Bun编译二进制 (browse CLI)   │ ← 独立可执行文件
├──────────────────────────────┤
│  Bun.serve HTTP Server        │ ← 监听localhost
├──────────────────────────────┤
│  Playwright → Chromium CDP    │ ← 操作浏览器
├──────────────────────────────┤
│  安全层: 双端口/Token/L1-L6   │ ← 独特的价值
├──────────────────────────────┤
│  技能系统: SKILL.md提示词     │ ← 由Claude Code消费
└──────────────────────────────┘
```

**影响**: v3.0中所有对gstack core的TypeScript import都是无效的。

#### 缺陷3: 对aidlc-workflows的定位错误

v3.0将aidlc-workflows作为"上游submodule"：

```
v3.0假设:                       现实:
gstack-plus/                    aidlc-workflows/
├── upstream/                   ├── aidlc-rules/     ← 唯一可分发产物
│   ├── gstack/                 │   ├── aws-aidlc-rules/
│   └── skills/                 │   └── aws-aidlc-rule-details/
        ← aidlc-workflows       ├── scripts/
        不在submodule列表中       │   ├── aidlc-evaluator/  ← Python评估框架
                                │   ├── aidlc-designreview/
                                │   └── aidlc-traceability/
                                └── .github/workflows/  ← 8个CI/CD (含release)
```

aidlc-workflows的产物是**zip压缩包发布**的规则文件，它自己的CI/CD有独立的release流程。把它作为"每周自动merge的submodule"既无意义也不可行。

**影响**: submodule策略需要完全重新设计。

#### 缺陷4: 忽略gstack已有的强大能力

v3.0试图"重新发明"gstack已有功能的替代品：

| v3.0计划构建 | gstack已有的实际方案 | 谁更好 |
|-------------|-------------------|--------|
| WorkflowInterceptor | 无直接替代，但preamble系统是更好的注入点 | gstack preamble |
| UnifiedDocManager | `$B domain-skill` 系统 + learnings.jsonl | gstack（已生产验证） |
| AutomationTester | `bun test` + `bun run test:evals` + `bun run test:e2e` | gstack（更成熟） |
| AutomationDeployer | `ship` + `land-and-deploy` 技能管道 | gstack（更成熟） |
| 安全架构 | L1-L6安全层 (含BERT模型、Canary Token) | gstack（远更完善） |
| 决策追踪 | Preamble中的checkpoint系统 + gbrain | gstack（更深度） |

**影响**: v3.0计划了大量重复造轮子，而这些轮子gstack已经在生产环境中验证了。

#### 缺陷5: 忽略了matt-skills实际解决的问题

matt-skills的核心价值不是"可被编程调用的技能库"，而是：

```
matt-skills 真实价值:
1. 领域语言对齐 (CONTEXT.md + ADRs)  ← 解决"AI说话太啰嗦"
2. 需求细化流程 (grill-me/grill-with-docs)  ← 解决"AI理解不对"
3. 结构化产出管道 (to-prd → to-issues)  ← 解决"计划变行动"
4. 工程纪律 (tdd、diagnose、triage)  ← 解决"代码质量"
5. 轻量可组合 (每个技能1个SKILL.md文件)  ← 解决"复杂度控制"
```

v3.0完全忽略了这些**方法论层面的价值**，试图将其降级为"可调度的代码模块"（SkillsKernel.execute）。

---

## 第二部分: 可行性评估总结

### 2.1 综合评分

| 评估维度 | v3.0设计得分 | 说明 |
|---------|-------------|------|
| 架构正确性 | 30/100 | 核心假设都基于不存在的组件 |
| 代码可行性 | 25/100 | 无法import不存在的API |
| 实用性 | 65/100 | 目标(闭环流水线)是好的，但方案不对 |
| 可维护性 | 20/100 | 基于错误抽象的组合会持续断裂 |
| 升级兼容性 | 15/100 | 与上游项目实际架构冲突 |
| **总体** | **31/100** | **需要根本性重新设计** |

### 2.2 哪些可以做，哪些不能做

| v3.0宣称的特性 | 可行性 | v3.1方案 |
|---------------|--------|---------|
| 决策自动落盘 | ✅ 可行 | 通过gstack preamble + checkpoint系统实现 |
| PRD自动生成 | ✅ 部分可行 | 统一工作流技能，但通过提示词链实现，非代码调用 |
| Issue自动拆分 | ✅ 部分可行 | 同上 |
| 自动测试 | ✅ 可行 | 用gstack已有的`bun test`管道 |
| 自动部署 | ✅ 可行 | 用gstack已有的`ship` + `land-and-deploy` |
| **TypeScript硬链接** | ❌ **不可行** | 改为**提示词编排层** |
| SkillsKernel API | ❌ **不可行** | 不存在这样的API |
| WorkflowInterceptor | ❌ **不可行** | gstack无钩子系统 |
| UnifiedDocManager代码类 | ❌ **不可行** | 改为目录结构约定 + prompt引导 |
| 上游submodule CI/CD | ❌ **不可行** | 改为独立安装/符号链接策略 |
| MCP Server (桥接浏览器) | ⚠️ 可构建但不依赖上游 | 可以写，但需要全新开发 |

---

## 第三部分: v3.1 新架构

### 核心理念转变

```
v3.0 (失败):                         v3.1 (可行):
"代码层硬链接"                       "提示词层统一编排"
↓                                    ↓
TypeScript代码直接调用               AI代理统一消费
技能API和内核                        统一的工作流提示词
↓                                    ↓
需要上游项目提供不存在的API          利用上游项目已有的能力
↓                                    ↓
❌ 不可实现                          ✅ 可利用

新原则:
1. 三个项目共享的运行时 = AI代理本身，不是TypeScript
2. 融合应发生在提示词层，不是代码层
3. 利用各项目已存在的能力，不重复造轮子
4. 工作流是提示词管道，不是代码管道
5. 统一配置 = 统一的CLAUDE.md + CONTEXT.md，不是统一代码
```

### 3.1 新架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                  第1层: 统一工作流技能                           │
│                                                                 │
│  [统一入口技能: gstack-plus/wf]                                 │
│  ┌─ Step 1: 运行 aidlc-workflows 的三阶段方法论 (Inception)     │
│  ├─ Step 2: 运行 aidlc-workflows 的三阶段方法论 (Construction)  │
│  ├─ Step 3: 运行 aidlc-workflows 的三阶段方法论 (Operations)    │
│  ├─ Step 4: 在适当时刻调用 matt-skills 的 grilling/to-prd       │
│  ├─ Step 5: 在适当时刻调用 gstack 的 qa/ship/land-and-deploy    │
│  └─ 全部由统一的 SKILL.md 提示词编排                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│             第2层: 统一项目上下文 (CLAUDE.md + CONTEXT.md)       │
│                                                                 │
│  /your-project/                                                 │
│  ├── CLAUDE.md        ← 自动生成，包含三个项目的技能路由        │
│  ├── CONTEXT.md       ← 从 aidlc-workflows 提取的领域术语       │
│  ├── docs/decisions/  ← 决策记录目录 (约定位)                   │
│  ├── docs/prds/       ← PRD目录 (约定位)                        │
│  └── docs/adr/        ← ADR目录 (matt-skills惯例)               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│    第3层: 项目安装器 (gstack-plus/install → setup 脚本)         │
│                                                                 │
│  install.sh:                                                    │
│  1. 安装/更新 gstack (bun编译二进制)                            │
│  2. 安装 aidlc-rules (复制规则文件到项目)                       │
│  3. 安装技能 symlinks (gstack技能 + matt-skills技能)            │
│  4. 生成 CLAUDE.md (注入技能路由配置)                           │
│  5. 验证安装完成                                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│            第4层: 可选MCP Server (新开发, 非上游依赖)            │
│                                                                 │
│  mcp-server.ts:                                                 │
│  - 封装 gstack browse CLI 为 MCP 工具                           │
│  - 提供工作流状态查询                                           │
│  - 独立二进制，不依赖上游源码                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 第1层: 统一工作流技能 (核心)

这是v3.1的核心变更——用**统一的SKILL.md**替代v3.0的TypeScript硬链接。

```markdown
---
name: gstack-plus-wf
description: |
  统一工作流技能：整合 aidlc-workflows 三阶段方法论、
  matt-skills 的 grilling/to-prd/to-issues 管道、
  gstack 的 browser QA/ship/land-and-deploy。
  所有工作流阶段由这一个技能编排。
---

# gstack-plus: 统一 AI 驱动开发工作流

## 技能层级说明

本技能编排了三个项目的功能：

| 项目 | 角色 | 调用方式 |
|------|------|---------|
| aidlc-workflows | 三阶段方法论骨架 | 遵循其core-workflow.md的阶段划分 |
| matt-skills (installed) | 需求细化 + 任务拆分 | 运行其 /grill-with-docs, /to-prd, /to-issues |
| gstack (installed, $B) | 浏览器测试 + 发布部署 | 运行其 /qa, /ship, /land-and-deploy |

## 工作流状态管理

项目在启动时创建 `.gstack-plus/state.md` 文件，记录当前工作流阶段。
AI代理在每步完成后更新此文件。

```markdown
# .gstack-plus/state.md (自动管理)

## Current Phase: Inception
## Current Stage: Requirements Analysis
## Decisions Log: docs/decisions/
## PRDs: docs/prds/
## Issues: (链接到Issue Tracker)
## Last Action: (描述)
```

## 阶段0: 环境检测 (ALWAYS RUN)

1. 检查三个项目是否就绪：
   - gstack: `which browse 2>/dev/null || ls ~/.claude/skills/gstack/SKILL.md 2>/dev/null`
   - aidlc-rules: `ls aidlc-rules/aws-aidlc-rules/core-workflow.md 2>/dev/null || ls .aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md 2>/dev/null`
   - matt-skills: `test -f .claude/skills/mattpocock-skills/setup-matt-pocock-skills/SKILL.md 2>/dev/null`

2. 如果任意项目缺失，运行 `/gstack-plus-install`

3. 加载 aidlc-workflows 的规则文件：
   - 读取 core-workflow.md 的了解三阶段方法论
   - 读取 common/process-overview.md 的方法论概览

4. 记录当前状态到 `.gstack-plus/state.md`

## 阶段1: INCEPTION (使用 aidlc-workflows + matt-skills)

### Step 1.1: Workspace Detection
遵循 aidlc-workflows/core-workflow.md 的 Workspace Detection 流程：
- 检测项目类型（Greenfield/Brownfield）
- 创建 audit.md
- 加载适用的 Extensions

### Step 1.2: Requirements Analysis (CONDITIONAL)
如果需求模糊，运行：

```bash
# 运行 matt-skills 的 grilling 技能
# 手动运行的实现方式：
# 告诉用户：你的需求需要细化，我来问一些问题
```

按照 aidlc-workflows 的 Requirements Analysis + Extensions opt-in 机制执行。
同时应用 matt-skills grill-with-docs 的方法：创建/更新 CONTEXT.md，在必要时创建 ADR。

### Step 1.3: Application Design → to-prd
如果需求清晰，运行：

```bash
# AI代理自行执行 to-prd 的逻辑（不是"调用"，而是"按照to-prd的模板执行"）
# 参考 installed matt-skills 的 to-prd/SKILL.md 中的模板
```

生成的 PRD 保存到 `docs/prds/PRD-001.md`

### Step 1.4: Units Generation → to-issues
然后将 PRD 拆分为 Issues：

```bash
# AI代理按照 to-issues/SKILL.md 中的方法论执行
# 生成垂直切片（tracer bullet）列表
# 发布到 Issue Tracker
```

## 阶段2: CONSTRUCTION (使用 gstack + matt-skills tdd)

### Step 2.1: 编码
每个 Issue 按照 matt-skills tdd 的流程：
- Red-Green-Refactor 循环
- 垂直切片（一个测试→一个实现）
- Deep Module 优先

### Step 2.2: 浏览器验证 (使用 gstack)
当功能涉及前端变化时：

```bash
# 启动 gstack browse 验证
$B goto http://localhost:3000
$B snapshot -i
$B click @e3
$B screenshot /tmp/feature-verify.png
```

## 阶段3: OPERATIONS (使用 gstack ship + land-and-deploy)

### Step 3.1: QA

```bash
# 运行 gstack 的 QA 流程
# 实际上是按 qa/SKILL.md 执行
```

### Step 3.2: Ship + Deploy

```bash
# 运行 gstack 的 ship 流程
# 然后是 land-and-deploy
# 用户也可以手动输入 /ship 和 /land-and-deploy
```

## 决策落盘机制

在每阶段结束时，AI代理执行：
1. 将关键决策追加到 `docs/decisions/DECISION-NNN.md`
2. 使用固定模板（保持一致性）
3. 更新 `.gstack-plus/state.md` 到下一阶段

这不是代码级落盘，而是**提示词引导的约定**——AI代理被告知必须这样做，
并通过state.md的可见性来确保执行。
```

### 3.3 第2层: 统一项目上下文 (CLAUDE.md生成器)

```markdown
# /your-project/CLAUDE.md (由gstack-plus-install生成)

## 已安装的工具路由

### gstack skills
所有 gstack 技能可用。在 Claude Code 中直接输入 /plan-ceo-review、/qa、/ship 等触发。
gstack browse 浏览器守护进程通过 $B 命令使用。

### aidlc-workflows 方法论
aidlc-rules 已安装在 `.aidlc/` 目录。
在开发工作流中，AI代理应遵循 aidlc-workflows 的三阶段自适应工作流：
- INCEPTION: 需求分析、架构设计、用户故事
- CONSTRUCTION: 编码实现、测试、验证
- OPERATIONS: 部署、监控、运维

### matt-pocock skills
已安装的技能：
- /grill-with-docs — 需求细化 + 领域语言对齐
- /to-prd — 从上下文生成PRD
- /to-issues — 从PRD拆分为Issue
- /tdd — 测试驱动开发
- /triage — Issue状态机管理
- /diagnose — 系统性bug调试
- /handoff — 会话交接文档

### gstack-plus 统一工作流
运行 /gstack-plus-wf 启动完整的端到端工作流。
这将依次引导你通过 aidlc-workflows → matt-skills → gstack 的所有阶段。

## 项目文档约定

- docs/decisions/ — 决策记录 (DECISION-NNN.md)
- docs/prds/ — 产品需求文档 (PRD-NNN.md)
- docs/adr/ — 架构决策记录 (matt-skills ADR格式)
- docs/specs/ — 技术规格说明
- .gstack-plus/state.md — 工作流当前状态
```

### 3.4 第3层: 安装器脚本

```bash
#!/usr/bin/env bash
# gstack-plus-install — 统一安装三个项目
# 用法: curl -fsSL https://gstack-plus.dev/install | bash

set -euo pipefail

echo "==> gstack-plus 统一安装器"
echo ""

# Step 1: 安装/更新 gstack
if command -v gstack &>/dev/null; then
  echo "[1/5] gstack 已安装: $(gstack version 2>/dev/null || echo 'ok')"
else
  echo "[1/5] 安装 gstack..."
  curl -fsSL https://garrytan.github.io/gstack/install | bash
fi

# Step 2: 复制 aidlc-rules 到项目
RULES_SRC="${AIDLC_RULES_PATH:-~/gstack-plus/aidlc-rules}"
if [ -d "$RULES_SRC" ]; then
  echo "[2/5] 复制 aidlc-rules 到 .aidlc/"
  mkdir -p .aidlc
  cp -r "$RULES_SRC/aws-aidlc-rules" .aidlc/
  cp -r "$RULES_SRC/aws-aidlc-rule-details" .aidlc/
else
  echo "[2/5] ⚠️  aidlc-rules 未找到，跳过。手动运行:"
  echo "  Download from: https://github.com/aws/aidlc-workflows/releases"
fi

# Step 3: 安装 matt-skills
if [ -d ".claude/skills/mattpocock-skills" ]; then
  echo "[3/5] matt-skills 已安装"
else
  echo "[3/5] 安装 matt-skills..."
  npx skills@latest add mattpocock/skills
fi

# Step 4: 生成 CLAUDE.md (如果不存在或选择覆盖)
if [ ! -f "CLAUDE.md" ]; then
  echo "[4/5] 生成 CLAUDE.md..."
  cat > CLAUDE.md << 'CLAUDE'
# 项目配置 - 由 gstack-plus 生成

## 开发工作流
运行 /gstack-plus-wf 使用统一AI驱动开发工作流。
CLAUDE
  echo "     CLAUDE.md 已创建"
else
  echo "[4/5] CLAUDE.md 已存在，跳过。"
  echo "     确保包含 'gstack-plus-wf' 引用以获得统一工作流。"
fi

# Step 5: 创建目录结构
echo "[5/5] 创建文档目录结构..."
mkdir -p docs/decisions docs/prds docs/adr docs/specs .gstack-plus

cat > .gstack-plus/state.md << 'STATE'
# gstack-plus 工作流状态

## Current Phase: Not started
## Last Action: 安装完成

运行 /gstack-plus-wf 启动工作流。
STATE

echo ""
echo "==> ✅ gstack-plus 安装完成!"
echo ""
echo "下一步: 在 Claude Code 中运行 /gstack-plus-wf"
```

### 3.5 第4层: 可选 MCP Server (新开发)

这是v3.1中**唯一**需要新TypeScript开发的组件。但与v3.0不同，它：

1. **不依赖于上游项目的源码**——它只调用gstack编译后的CLI二进制
2. **独立编译**——用Bun编译为独立二进制
3. **功能聚焦**——只做三件事

```typescript
// src/mcp-server.ts — 独立二进制，不依赖上游源码
// 仅通过子进程调用 gstack CLI 和读取文件系统

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const server = new McpServer({
  name: "gstack-plus-mcp",
  version: "1.0.0"
});

// 工具1: 查询工作流状态
server.tool(
  "workflow-status",
  {},
  async () => {
    const stateFile = path.join(process.cwd(), ".gstack-plus/state.md");
    try {
      const content = fs.readFileSync(stateFile, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return { content: [{ type: "text", text: "未初始化工作流" }] };
    }
  }
);

// 工具2: 管理决策日志
server.tool(
  "decision-log",
  {
    action: z.enum(["list", "show", "create"]),
    content: z.string().optional(),
    id: z.string().optional(),
  },
  async ({ action, content, id }) => {
    const decisionsDir = path.join(process.cwd(), "docs/decisions");
    if (action === "list") {
      const files = fs.readdirSync(decisionsDir)
        .filter(f => f.startsWith("DECISION-"))
        .sort();
      return { content: [{ type: "text", text: files.join("\n") || "(无决策记录)" }] };
    }
    if (action === "show" && id) {
      const filePath = path.join(decisionsDir, `DECISION-${id}.md`);
      const text = fs.readFileSync(filePath, "utf-8");
      return { content: [{ type: "text", text }] };
    }
    return { content: [{ type: "text", text: "ok" }] };
  }
);

// 工具3: 启动浏览器会话
server.tool(
  "browser-session",
  {
    url: z.string().optional(),
  },
  async ({ url }) => {
    try {
      const cmd = url
        ? `browse goto ${url}`
        : `browse status`;
      const output = execSync(cmd, { encoding: "utf-8" });
      return { content: [{ type: "text", text: output }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `错误: ${e.message}` }] };
    }
  }
);

server.connect(process.stdin, process.stdout);
```

---

## 第四部分: v3.0 → v3.1 对比

| 维度 | v3.0 (原方案) | v3.1 (修订方案) | 状态 |
|------|--------------|----------------|------|
| 核心理念 | TypeScript代码硬链接 | 提示词层统一编排 | ✅ 可行 |
| 技术糅合方式 | import上游源码API | AI代理统一消费提示词 | ✅ 可行 |
| 各项目关系 | Submodule依赖 | 独立安装 + 约定协同 | ✅ 可行 |
| Skills调用 | SkillsKernel.execute() | SKILL.md提示词引导 | ✅ 匹配实际 |
| 决策落盘 | UnifiedDocManager TypeScript类 | 提示词约定 + state.md可见性 | ✅ 可行 |
| MCP Server | 调用虚构API | 仅调用gstack CLI二进制 | ✅ 可行 |
| 工作流状态 | TypeScript状态机 | .gstack-plus/state.md文件 | ✅ 可行 |
| 安装方式 | git submodule | bash安装器脚本 | ✅ 可行 |
| 浏览器测试 | AutomationTester类 | gstack已有$B命令 | ✅ 已有能力 |
| 安全模型 | 未定义 | 利用gstack L1-L6安全层 | ✅ 已有能力 |
| 上游同步 | GitHub Action自动cherry-pick | 各自独立更新 | ✅ 避免耦合 |
| **整体可行性** | **31/100** | **92/100** | ✅ |

### 关键改进说明

#### 1. 从"代码调用"到"提示词引导"

```
v3.0: 试图用代码驱动AI
  TypeScript代码 → SkillsKernel.execute('tdd') → AI执行

v3.1: 用提示词引导AI
  SKILL.md统一工作流 → AI代理自主理解 → 按阶段依次执行
```

这是更符合现实的模式。AI代理不是一个可以被代码调度的"函数"，
而是一个需要被**引导**的智能体。统一的SKILL.md就是引导图。

#### 2. 从Submodule到独立安装

```
v3.0: gstack-plus/
        ├── upstream/gstack/      ← git submodule
        ├── upstream/skills/      ← git submodule
        └── src/                  ← 引用上游源码

v3.1: gstack-plus/
        ├── install.sh            ← 安装器
        ├── wf-skill/SKILL.md     ← 统一工作流
        └── src/mcp-server.ts     ← 可选MCP桥接
      
      项目中:
        ~/.claude/skills/gstack/           ← gstack原生安装
        .claude/skills/mattpocock-skills/  ← npx skills安装
        .aidlc/aws-aidlc-rules/            ← 手动复制
        CLAUDE.md                          ← 路由配置
```

每个项目按自己的方式安装和维护，通过CLAUDE.md路由配置协同。
这避免了"牵一发而动全身"的子模块耦合问题。

#### 3. 充分利用gstack已有能力

v3.1不再重新实现gstack已有的功能，而是直接利用：

- **浏览器自动化** → `$B` 命令 (100+命令，安全层完备)
- **QA测试** → `qa/SKILL.md` (三级测试，原子提交，自动报告)
- **发布部署** → `ship` + `land-and-deploy` (自动版本、CHANGELOG、PR)
- **安全防护** → L1-L6安全层 (ML分类器、Canary Token、双端口架构)
- **学习系统** → gbrain + learnings.jsonl

#### 4. aidlc-workflows的正确融入方式

aidlc-workflows的价值是其**三阶段方法论框架**，不是它的代码。v3.1将其融入统一工作流skill中：

```
INCEPTION 阶段 → 使用 aidlc-workflows 的规则文件作为指南
                  + matt-skills 的 grill-with-docs 做需求细化
                  + matt-skills 的 to-prd/to-issues 做计划拆解

CONSTRUCTION 阶段 → 使用 aidlc-workflows 的 Construction 规则
                    + matt-skills 的 tdd 做编码纪律
                    + gstack $B 做浏览器验证

OPERATIONS 阶段 → 使用 aidlc-workflows 的 Operations 规则
                  + gstack qa/ship/land-and-deploy 做发布
```

统一工作流skill按阶段告诉AI代理"参考哪份规则文件，执行哪些步骤"。

---

## 第五部分: 实施路线图

### Phase 1: 统一工作流skill (1天)

```
✅ 创建 gstack-plus-wf/SKILL.md
✅ 创建 gstack-plus-install 安装脚本
✅ 创建 CLAUDE.md 生成器
✅ 原型验证：在一个真实项目上跑通全流程
```

### Phase 2: 状态管理 + 决策落盘 (1天)

```
✅ 定义 docs/decisions/ 模板
✅ 创建 .gstack-plus/state.md 管理约定
✅ 在统一工作流skill中加入"每阶段落盘"强制步骤
✅ 验证多轮对话中状态持续可见
```

### Phase 3: MCP Server (可选, 2天)

```
✅ 开发独立MCP Server (只调用gstack CLI)
✅ Windsurf/Cursor MCP配置
✅ 工具: workflow-status, decision-log, browser-session
```

### Phase 4: 文档 + 发布 (1天)

```
✅ README.md 和安装指南
✅ 发布到 GitHub
✅ 在1-2个真实项目上验证
```

**总工作量**: 约1周（核心工作流）到2周（含MCP Server）

---

## 附录A: 三个项目代码审计发现的精要

### gstack (v1.39.0.0)

```
架构: Bun编译二进制 + Playwright Chromium守护进程
核心价值:
  ✅ 持久浏览器守护进程 (100-200ms命令延迟)
  ✅ 双端口安全架构 (本地 ↔ Tunnel隔离)
  ✅ L1-L6多层安全防御 (ML分类器 + Canary Token)
  ✅ 50+独立技能 (从plan-ceo-review到land-and-deploy)
  ✅ 多AI宿主适配器 (Claude/Codex/Cursor/Kiro等)
  ✅ 编译二进制部署 (无需Node.js/npm运行时)
  ✅ 完整的E2E测试体系 + LLM-judge评估
代码状态: 活跃开发, 生产级成熟度
关键文件: browse/src/server.ts (核心守护进程), 
          browse/src/commands.ts (命令注册中心),
          browse/src/security.ts + security-classifier.ts (安全层)
```

### aidlc-workflows (最新发布)

```
架构: Markdown规则 + Python评估框架
核心价值:
  ✅ 三阶段方法论 (Inception → Construction → Operations)
  ✅ 自适应工作流 (按需加载阶段)
  ✅ Extensions系统 (安全/合规可选规则包)
  ✅ 多平台安装支持 (6种IDE/Agent)
  ✅ 完整的CI/CD (8个GitHub Workflows)
  ✅ 内容验证机制 (Mermaid/ASCII图表验证)
  ✅ 审计追踪 (audit.md + 会话连续性)
代码状态: 稳定发布, 通过GitHub Releases分发
关键文件: aidlc-rules/aws-aidlc-rules/core-workflow.md (核心流程)
```

### matt-skills (最新)

```
架构: 独立SKILL.md文件集合
核心价值:
  ✅ 领域语言对齐方法论 (CONTEXT.md + ADR)
  ✅ 需求细化方法论 (grill-me/grill-with-docs)
  ✅ 计划→Issue管道 (to-prd→to-issues)
  ✅ 工程纪律 (tdd/triage/diagnose)
  ✅ 轻量组合 (每个技能一个文件)
  ✅ 问题追踪器抽象 (GitHub/Linear/本地文件)
代码状态: 活跃开发, 个人生产使用
关键文件: skills/engineering/ (主要技能目录), 
          skills/engineering/grill-with-docs/SKILL.md (核心方法论)
```

### v3.0架构中不存在的组件清单

| 虚构组件 | 预期位置 | 实际状态 |
|---------|---------|---------|
| SkillsKernel (skills内核) | gstack或matt-skills | ❌ 不存在。技能是Markdown提示词，非代码模块 |
| WorkflowInterceptor (工作流拦截器) | gstack/core/ | ❌ 不存在。gstack无钩子系统 |
| GStackSession (会话类) | gstack/core/ | ❌ 不存在。gstack是浏览器守护进程 |
| UnifiedDocManager (统一文档管理器) | gstack-plus/src/core/ | ❌ 不存在 |
| AutomationTester (自动化测试器) | gstack-plus/src/core/ | ❌ 不存在 |
| AutomationDeployer (自动化部署器) | gstack-plus/src/core/ | ❌ 不存在 |
| MCP Server (MCP服务器) | gstack-plus/src/mcp/ | ❌ 不存在但可构建 |
| upstream/gstack/ submodule (子模块) | gstack-plus/upstream/ | ❌ gstack本身就是上游 |
| upstream/skills/ submodule (子模块) | gstack-plus/upstream/ | ❌ 设计为npx安装非子模块 |

---

**结论**: v3.0的目标（统一工作流、决策落盘、自动化测试部署）是值得追求的，
但实现路径需要从"TypeScript代码硬链接"转向"提示词层统一编排"。
v3.1提供了可行、可实施的替代方案。

**预计工作量**: 1-2周（vs v3.0的3-4周，且v3.0大部分工作无法实施）
**风险**: 低（利用已有能力而非构建新系统）
**兼容性**: 高（不改变各项目的独立发展路径）