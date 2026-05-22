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

## ## 第三部分: v3.1 新架构

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

### 3.1 新架构总览 (含完整评审验证管道)

```
┌──────────────────────────────────────────────────────────────────────┐
│               第1层: 统一工作流技能 (gstack-plus-wf)                  │
│                          ↓ (按阶段编排)                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  INCEPTION 阶段: 评审驱动规划                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │ 自动选择评审方案 (Auto-Review Router)                     │  │   │
│  │  │                                                          │  │   │
│  │  │  检测输入类型 → 自动判定需要哪些评审:                      │  │   │
│  │  │                                                          │  │   │
│  │  │  新产品/大功能 → /autoplan                               │  │   │
│  │  │    ├── CEO Review (战略/产品方向)                         │  │   │
│  │  │    ├── Design Review (设计方案)                           │  │   │
│  │  │    ├── Eng Review (架构/数据流/测试)                      │  │   │
│  │  │    └── DX Review (开发者体验)                             │  │   │
│  │  │                                                          │  │   │
│  │  │  中等功能 → /plan-eng-review + 按需叠加:                   │  │   │
│  │  │    ├── 前端变化 → +/plan-design-review                    │  │   │
│  │  │    ├── 敏感数据 → +/cso (安全审计)                        │  │   │
│  │  │    └── 公开API → +/plan-devex-review                      │  │   │
│  │  │                                                          │  │   │
│  │  │  小改动/Bug修复 → 跳过规划评审 → 直接到 Construction       │  │   │
│  │  │                                                          │  │   │
│  │  │  + 全量: aidlc-workflows 规则检查 + matt-skills 术语对齐   │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │       ↓                                                        │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  CONSTRUCTION 阶段: 开发 + 增量验证                         │  │   │
│  │  │                                                          │  │   │
│  │  │  编码 → TDD (matt-skills)                                │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  自测 → npm test / bun test (gstack已有管道)              │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  浏览器验证 (gstack $B) — 仅前端变化时                     │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  QA验证 (gstack /qa) — 完整功能分支时                      │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  设计审计 (gstack /design-review) — 前端变化时             │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │       ↓                                                        │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  OPERATIONS 阶段: 多层验证 + 部署                          │  │   │
│  │  │                                                          │  │   │
│  │  │  预合并评审 (gstack /review)                              │  │   │
│  │  │    ├── SQL安全 / 数据安全                                  │  │   │
│  │  │    ├── LLM信任边界验证                                     │  │   │
│  │  │    ├── Shell注入检查                                       │  │   │
│  │  │    ├── 并发/竞态条件                                       │  │   │
│  │  │    └── 枚举值完整性                                        │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  性能基线 (gstack /benchmark) — 前端变化时                 │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  发布 (gstack /ship)                                      │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  合并+部署 (gstack /land-and-deploy)                      │  │   │
│  │  │    ↓                                                      │  │   │
│  │  │  金丝雀监控 (gstack /canary)                              │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│          第2层: 统一项目上下文 (CLAUDE.md + CONTEXT.md)               │
│                                                                      │
│  /your-project/                                                      │
│  ├── CLAUDE.md        ← 自动生成，含完整技能路由                      │
│  ├── CONTEXT.md       ← 从 aidlc-workflows 提取的领域术语             │
│  ├── docs/decisions/  ← 决策记录目录 (约定位)                         │
│  ├── docs/prds/       ← PRD目录 (约定位)                              │
│  ├── docs/adr/        ← ADR目录 (matt-skills惯例)                     │
│  ├── docs/specs/      ← 技术规格                                      │
│  └── .gstack-plus/state.md ← 工作流状态                               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│    第3层: 项目安装器 (gstack-plus-install)                           │
│                                                                      │
│  install.sh:                                                         │
│  1. 安装/更新 gstack (bun编译二进制)                                 │
│  2. 安装 aidlc-rules (复制规则文件到项目)                            │
│  3. 安装 matt-skills (npx skills@latest add)                         │
│  4. 初始化 gbrain (可选: 决策+技能知识库)                            │
│  5. 生成 CLAUDE.md + 目录结构                                         │
│  6. 安装 gstack-plus-wf 技能 (符号链接到项目)                         │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│    第4层: 可选MCP Server (新开发, 非上游依赖)                        │
│                                                                      │
│  gstack-plus-mcp:                                                    │
│  - 仅调用 gstack CLI 二进制 (子进程)                                  │
│  - 工作流状态查询 (读取 .gstack-plus/state.md)                       │
│  - 决策日志管理                                                     │
│  - 独立Bun编译二进制                                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 第1层核心: 自动评审路由引擎 (Auto-Review Router)

这是v3.1最重要的新增组件——一个提示词驱动的**自动检测和路由系统**，
它分析当前输入特征，自动选择需要运行的评审技能，并在每个关卡自动推荐决策。

```markdown
---
name: gstack-plus-wf
preamble-tier: 4
version: 2.0.0
description: |
  gstack-plus 统一 AI 驱动开发工作流。
  整合 aidlc-workflows 三阶段方法论、matt-skills 需求细化/任务拆分工程纪律、
  gstack 的完整评审管道 (autoplan/ceo/eng/design/security/review/qa/ship/deploy/canary)。
  自动检测输入范围，智能选择和排序评审技能，全自动通过6原则做默认决策。
---

# gstack-plus: 统一 AI 驱动开发工作流

## 技能依赖树

本工作流由三个项目的技能协同驱动：

| 来源 | 技能 | 调用时机 |
|------|------|---------|
| **aidlc-workflows** | core-workflow.md 三阶段方法 | 工作流骨架基座 |
| **aidlc-workflows** | Extensions (安全/合规) | Inception Rules加载 |
| **aidlc-workflows** | audit.md + 会话连续性 | 全流程 |
| **matt-skills** | /grill-with-docs | Inception: 需求模糊时 |
| **matt-skills** | /to-prd | Inception: 需求清晰后 |
| **matt-skills** | /to-issues | Inception: PRD完成后 |
| **matt-skills** | /tdd | Construction: 每个Issue |
| **matt-skills** | /triage | Operations: Issue管理 |
| **matt-skills** | /diagnose | Construction: Bug出现时 |
| **matt-skills** | /handoff | 工作流切换/中断时 |
| **gstack** | /autoplan | Inception: 宏大/新产品计划 |
| **gstack** | /plan-ceo-review | Inception: 战略评审需求 |
| **gstack** | /plan-eng-review | Inception: 架构评审 |
| **gstack** | /plan-design-review | Inception: 前端方案评审 |
| **gstack** | /plan-devex-review | Inception: API/CLI方案评审 |
| **gstack** | /cso (security audit) | Inception: 安全敏感输入 |
| **gstack** | /qa | Construction: 功能分支验证 |
| **gstack** | /design-review | Construction: 前端视觉审计 |
| **gstack** | /investigate | Construction: 系统调试 |
| **gstack** | /review | Operations: 预合并代码评审 |
| **gstack** | /benchmark | Operations: 性能基线 |
| **gstack** | /ship | Operations: 发布 |
| **gstack** | /land-and-deploy | Operations: 部署 |
| **gstack** | /canary | Operations: 生产监控 |
| **gstack** | /gstack-upgrade | 安装/维护 |
| **gstack** | $B (browse CLI) | 随时: 浏览器自动化 |
```

## 工作流状态管理

```markdown
# .gstack-plus/state.md (由AI代理自动维护)

## Current Phase: [Inception|Construction|Operations]
## Current Stage: [具体的阶段名]
## Decisions Log: docs/decisions/
## PRDs: docs/prds/
## Issues: [链接到Issue Tracker]
## Last Action: [当前最后一步的操作描述]
## Review Pipeline Status: [列表: 已完成的评审/待处理的评审/跳过原因]
## Pending Review Decisions: [等待用户确认的自动决策]
```

---

## 阶段0: 范围检测 + 评审路由 (ALWAYS RUN)

### 0.1 环境检测

1. 检查三个项目是否就绪：
   - gstack: `which browse 2>/dev/null || ls ~/.claude/skills/gstack/SKILL.md 2>/dev/null`
   - aidlc-rules: `ls aidlc-rules/aws-aidlc-rules/core-workflow.md 2>/dev/null || ls .aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md 2>/dev/null`
   - matt-skills: `test -d .claude/skills/mattpocock-skills 2>/dev/null`

2. 如果任意缺失，运行 `/gstack-plus-install`

3. 加载 aidlc-workflows 规则文件（如可用）

### 0.2 输入范围检测 (自动评审路由)

这是整个工作流的决策入口。AI代理分析当前输入特征，自动判定工作范围和深浅：

```bash
# 检测变化范围
DIFF_STAT=$(git diff --stat 2>/dev/null | tail -1)
DIFF_FILES=$(git diff --name-only 2>/dev/null | wc -l)
DIFF_LINES=$(echo "$DIFF_STAT" | grep -oP '\d+' | tail -1 || echo "0")
HAS_FRONTEND=$(git diff --name-only 2>/dev/null | grep -cE '\.(tsx|jsx|css|scss|html|vue|svelte)$' || true)
HAS_SECURITY=$(git diff --name-only 2>/dev/null | grep -cE '(auth|oauth|jwt|password|secret|token|cookie|session|permission|encrypt|decrypt|ssl|tls|cert)' || true)
HAS_API=$(git diff --name-only 2>/dev/null | grep -cE '(route|api|endpoint|graphql|grpc|webhook)' || true)
HAS_DB=$(git diff --name-only 2>/dev/null | grep -cE '(schema|migration|sql|query|model|entity|repository|database|table)' || true)
```

#### 范围分类与路由决策

| 范围特征 | 分类 | 需要运行的评审 | 可自动决策 |
|---------|------|--------------|-----------|
| 新建产品/大功能 (>20文件, >500行) | **宏大变更** | /autoplan (含CEO+Design+Eng+DX四阶段) | 机械问题: 自动 |
| 中等功能 (5-20文件, 100-500行) | **功能级变更** | /plan-eng-review + 按需加载 | 机械问题: 自动 |
| 小改动 (<5文件, <100行) | **增量变更** | 跳过规划评审 → 直接到Construction | 全部自动 |
| Bug修复 | **缺陷修复** | 跳过规划评审 → /diagnose → Construction | 全部自动 |

**自动评审路由规则:**

```
条件: HAST_FRONTEND > 0
  → 在Inception阶段叠加 /plan-design-review
  → 在Construction阶段叠加 /design-review
  → 在Operations阶段叠加 /benchmark

条件: HAS_SECURITY > 0 或 处理敏感数据
  → 在Inception阶段叠加 /cso (安全审计)
  → 在Operations阶段 /review 强制执行安全类检查项

条件: HAS_API > 0 或 对外暴露接口
  → 在Inception阶段叠加 /plan-devex-review

条件: HAS_DB > 0 或 涉及数据迁移
  → 在Operations阶段 /review 强制执行SQL安全检查项
  → 在Construction阶段确保包含回滚计划

条件: 范围 = "宏大变更"
  → 直接路由到 /autoplan (自动运行CEO→Design→Eng→DX全流水线)
  → 不运行独立的 /plan-*-review (autoplan已包含)
```

**"自动决策"的定义:**
- **机械决策**: 有明显正确答案的问题 → AI自动用6原则决策，记入state
- **品味决策**: 合理的人可能有分歧 → AI自动决策但记入Pending Review Decisions供最终确认
- **用户挑战**: 两个模型都建议改变用户的方向 → 必须等待用户确认

---

## 阶段1: INCEPTION (评审驱动的规划)

### Step 1.1: 按路由结果执行评审管道

根据阶段0的判定结果，路由到不同路径：

```
                 ┌──────────────────────┐
                 │  输入范围分类结果      │
                 └──────────┬───────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                   ▼
    ┌──────────┐     ┌──────────┐      ┌────────────┐
    │ 宏大变更  │     │ 功能级变更 │      │ 增量/修复   │
    └─────┬────┘     └─────┬────┘      └──────┬─────┘
          │                │                   │
          ▼                ▼                   ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐
    │ /autoplan       │ │ /plan-eng-review │ │ 跳过规划评审  │
    │ 自动CEO+Design+ │ │ + 按需叠加       │ │              │
    │ Eng+DX四阶段    │ │  -前端→design   │ │ → 直接到     │
    │ 6原则自动决策   │ │  -安全→cso      │ │   Construction│
    │ 品味决策打标     │ │  -API→devex     │ │              │
    └─────────────────┘ └─────────────────┘ └──────────────┘
          │                │                   
          ▼                ▼                   
    ┌─────────────────────────────────────────┐
    │ 评审输出: 决策日志 + 设计文档 + 架构图    │
    │ 保存到 docs/decisions/DECISION-NNN.md    │
    └─────────────────────────────────────────┘
```

#### 路径A: 宏大变更 → /autoplan（完整四阶段评审管线）

严格遵循 gstack /autoplan 的步骤：
1. Phase 0: 创建恢复点，读取上下文，检测范围
2. Phase CEO: 用6原则自动决策，Premises问题必须问用户
3. Phase Design: 视觉/交互方案评审，前端变化时执行
4. Phase Eng: 架构、数据流、边界情况、测试覆盖
5. Phase DX: 开发者体验评审，对外接口时执行
6. **最终审批门**: 展示所有品味决策、用户挑战，等待确认

输出:
- 更新后的计划文件（含所有评审结果）
- 决策日志 (`docs/decisions/DECISION-NNN.md`)
- 设计文档 (如适用)
- 状态文件更新为"规划完成"

#### 路径B: 功能级变更 → /plan-eng-review + 按需叠加

1. 按自动路由配置加载叠加技能
2. 运行 /plan-eng-review 的完整步骤：
   - 范围挑战 (Step 0)
   - 优先级排序 (Design Doc Check)
   - 架构评审
   - 测试策略
   - 数据流图 (强制ASCII图表)
   - 边界情况映射
3. 如果叠加了 /cso: 在eng review完成后运行安全审计
4. 如果叠加了 /plan-design-review: 围绕DESIGN.md做设计评审
5. 如果叠加了 /plan-devex-review: 围绕开发者体验做评审

输出: 架构决策记录 + 评审总结

#### 路径C: 增量/修复 → 跳过规划评审

直接推进到 Construction，但记录一条跳过的原因：
"增量变更(少于5文件)，跳过规划评审，直接进入Construction。"

---

### Step 1.2: 需求细化 (CONDITIONAL — 仅模糊需求时)

如果需求不清晰或用户指定需要细化：

1. 加载 aidlc-workflows 的 Requirements Analysis + Extensions opt-in 机制
2. 运行类似 matt-skills /grill-with-docs 的追击流程：
   - 向用户逐一追问设计树的分支
   - 创建/更新 CONTEXT.md (领域术语对齐)
   - 必要时创建 ADR (架构决策记录)
   - 每一步给出推荐答案
3. 记录细化后的需求到 audit.md 和决策日志

### Step 1.3: PRD生成 (至to-prd方法论)

1. 参考 installed matt-skills 的 to-prd/SKILL.md 模板
2. 生成 PRD 保存到 `docs/prds/PRD-NNN.md`
3. PRD 中必须引用决策日志 (`docs/decisions/DECISION-NNN.md`)

### Step 1.4: 任务拆分 (至to-issues方法论)

1. 参考 installed matt-skills 的 to-issues/SKILL.md 的方法论
2. 使用垂直切片 (tracer bullet) 方法拆分任务
3. 发布到 Issue Tracker (GitHub/Linear/本地文件)
4. 每个Issue包含决策日志链接

---

### Inception阶段完成检查清单

在进入Construction前确认：

- [ ] 范围检测和评审路由已完成
- [ ] 所有自动决策已记录到 `docs/decisions/`
- [ ] 品味决策已打标等待最终确认
- [ ] 用户挑战已解决（如果有）
- [ ] aidlc-workflows extensions 已处理 opt-in/opt-out
- [ ] CONTEXT.md 已创建/更新（需要时）
- [ ] PRD 已生成（大功能/新功能时）
- [ ] Issues 已拆分（大功能/新功能时）
- [ ] 当前状态已更新到 `.gstack-plus/state.md`

---

## 阶段2: CONSTRUCTION (增量验证 + 质量门)

### Step 2.1: TDD编码 (matt-skills 方法论)

对每个 Issue:

1. **规划**: 确认接口设计和测试行为优先级
2. **红-绿-重构** 垂直切片循环（一次一个测试，一次一个实现）
3. Deep Module 优先（小接口封装大功能）
4. 运行 `npm test` 或 `bun test` 确保现有测试通过

### Step 2.2: 浏览器端到端验证 (gstack $B — 有前端变化时)

当选定的范围包含前端变化时:

```bash
# 启动gstack浏览器守护进程
$B goto localhost:3000

# 自动验证核心流程
$B snapshot -i
# ... 按功能流程操作 ...

# 截取结果证据
$B screenshot .gstack-plus/screenshots/feature-verify.png
```

### Step 2.3: QA验证 (gstack /qa — 功能分支完成时)

当功能分支开发完成时:

按照 gstack /qa 的完整流程执行:
1. **Setup**: 参数解析(URL/范围/深度/认证)
2. **基线建立**: 核心流程全路径走过
3. **Bug发现+修复**: 每个bug原子提交，自动修复
4. **验证**: 修复后截图对比
5. **报告**: 健康评分、修复证据、可发布性总结

QA Tier自动选择:
- Quick (仅Critical/High) — 小改动时
- Standard (+Medium) — 默认
- Exhaustive (+Low/Cosmetic) — 前端大改动时

### Step 2.4: 设计审计 (gstack /design-review — 前端变化时)

当有前端变化时:

按照 gstack /design-review 执行6阶段设计审计:
1. **第一印象** — 首屏整体评估
2. **间距/对齐** — 一致性检查
3. **排版/色彩** — 字体层级与配色方案
4. **响应式** — 移动/平板/桌面三个断点
5. **交互/动效** — 状态变化、过渡动画
6. **AI杂讯检测** — 识别AI生成的通用设计模式

修复循环: 每个发现的视觉问题 → 原子提交修复 → 前后截图对比

### Step 2.5: 系统调试 (gstack /investigate — Bug出现时)

当遇到难以定位的Bug时，按照 gstack /investigate 的6阶段:
1. **建反馈回路** — 快速确定性pass/fail信号
2. **复现** — 确认循环可靠复现用户描述的bug
3. **假设** — 生成3-5个可证伪的排序假设（展示给用户）
4. **仪器化** — 每次探测对应一个假设
5. **修复+回归测试** — 正确接口处的回归测试
6. **清理+事后** — 移除探测代码，思考"什么可以阻止这个bug"

---

### Construction阶段完成检查清单

- [ ] 所有Issues已完成编码
- [ ] 单元测试通过 (`npm test` / `bun test`)
- [ ] QA验证完成 (如果有前端变化)
- [ ] 设计审计完成 (如果有前端变化)
- [ ] 所有bug已修复或记录
- [ ] 屏幕截图证据保存到 `.gstack-plus/screenshots/`

---

## 阶段3: OPERATIONS (多层验证 + 部署)

### Step 3.1: 预合并评审 (gstack /review — 强制执行)

按照 gstack /review 的完整检查清单执行:

1. **获取diff** → `git diff origin/<base>`
2. **Slop扫描** → `bun run slop:diff` (AI代码质量检查)
3. **关键安全检查清单**:
   - SQL & 数据安全 — SQL注入、数据泄露路径
   - 竞态条件 & 并发 — 共享状态、原子操作
   - LLM输出信任边界 — LLM输出是否经过验证后写入DB
   - Shell注入 — `exec`/`spawn`中用户输入是否被引号包裹
   - 枚举完整性 — 新枚举值是否在所有switch/if-else中被处理
4. **信息检查清单**:
   - 异步/同步混合 — async中是否有阻塞调用
   - 类型安全 — 隐式any、类型断言危险
   - 前端 — 可访问性、加载状态、错误状态
   - 超时安全 — 所有外部调用的超时处理
5. **问题分类**:
   - AUTO-FIX: 直接修复并输出 `[AUTO-FIXED]`
   - ASK: 打包展示给用户，每项"修复/跳过"选择
6. **输出**:
   ```markdown
   [AUTO-FIXED] src/file.ts:42 — 添加SQL参数化查询
   [ASK] src/file.ts:88 — 竞态条件需要判断
   [CLEAR] 其余检查项全部通过
   ```

额外: 根据路由阶段的检测结果，强制执行对应检查项:
- HAS_DB → 强制检查SQL安全类别
- HAS_SECURITY → 强制检查LLM信任边界、Shell注入
- HAS_FRONTEND → 强制检查前端类别

### Step 3.2: 性能基线 (gstack /benchmark — 前端变化时)

当有前端变化时:

按照 gstack /benchmark 流程:
1. **基线建立** — 页面加载时间、Core Web Vitals、资源大小
2. **对比** — 修改前后性能对比
3. **趋势追踪** — 与历史基线比较

输出: 性能报告保存到 `.gstack-plus/benchmark/`

### Step 3.3: 发布 (gstack /ship)

按照 gstack /ship 的完全自动化流程:
1. Pre-flight: 确认分支正确
2. 分发管道检查
3. 测试运行
4. 覆盖审计
5. 计划完成审计
6. 版本bump + CHANGELOG更新
7. Commit + Push
8. PR创建

### Step 3.4: 合并+部署 (gstack /land-and-deploy)

按照 gstack /land-and-deploy 流程:
1. Pre-flight: GitHub CLI认证
2. PR状态检查
3. 预合并就绪门（评审/测试/文档）
4. 合并PR
5. CI等待
6. 部署验证

### Step 3.5: 金丝雀监控 (gstack /canary — 部署后)

部署后，按 gstack /canary 执行:
1. 定期截图对比部署前基线
2. 控制台错误监控
3. 性能回归检测
4. 异常告警: 自动回滚通知

---

### Operations阶段完成检查清单

- [ ] 预合并评审完成 (所有AUTO-FIX已应用, ASK已确认)
- [ ] 性能基线已记录 (前端变化时)
- [ ] /ship 已完成 (PR已创建)
- [ ] /land-and-deploy 已完成 (已合并并部署)
- [ ] 金丝雀巡检通过 (部署后)
- [ ] 全流程状态已记录

---

## 自动决策的6原则 (继承自gstack /autoplan)

这些原则用于自动回答评审过程中的中间问题:

1. **选择完整性** — 覆盖更多边界情况
2. **煮沸湖泊** — 修复波及范围内的所有问题
3. **务实** — 选择更简洁的方案
4. **DRY** — 不重复造轮子
5. **显式优于巧妙** — 新贡献者30秒读懂
6. **偏向行动** — 合并 > 更多评审 > 陈旧讨论

**冲突解决:**
- CEO阶段: P1(完整性) + P2(煮沸湖泊)主导
- Eng阶段: P5(显式) + P3(务实)主导
- Design阶段: P5(显式) + P1(完整性)主导

### 决策分类系统

每项自动决策标记为:

| 分类 | 含义 | 处理方式 |
|------|------|---------|
| **机械决策** | 有一个明显正确答案 | 自动决策，静默执行 |
| **品味决策** | 合理的人可能有分歧 | 自动决策但最终门展示 |
| **用户挑战** | 两个模型都推荐改变用户方向 | 必须等待用户确认 |

---

## 决策落盘机制

每阶段结束时的强制动作:

1. 创建/更新 `docs/decisions/DECISION-NNN.md` (固定模板，保持一致性)
2. 更新 `.gstack-plus/state.md` 到下一阶段
3. 记录所有未解决的品味决策供最终确认

```markdown
# docs/decisions/DECISION-001.md 模板

# DECISION-001: [决策标题]

* **Status**: [Approved/ Draft/ Rejected]
* **Date**: 2026-05-22
* **Source**: gstack-plus-wf 统一工作流 — Step [阶段名]
* **Decision Type**: [机械决策/品味决策/用户挑战]
* **Decision Rules Applied**: [P1-P6中应用的规则编号]

## 问题

[简洁描述需要决策的问题]

## 分析

[AI代理对选项的分析]

## 选择

[最终选择]

## 理由

[为什么选这个]
```

### 3.3 第2层: 统一项目上下文 (CLAUDE.md生成器)

```markdown
# /your-project/CLAUDE.md (由gstack-plus-install生成)

## 已安装的技能路由

### gstack 完整评审管线 (自动路由)
运行 /gstack-plus-wf 启动统一工作流，自动选择评审方案。
也可手动调用单个技能：

**规划评审:**
- /autoplan — 自动全管道(CEO→Design→Eng→DX)，用6原则自动决策
- /plan-ceo-review — 战略/产品方向评审（4种模式）
- /plan-eng-review — 架构/数据流/测试评审
- /plan-design-review — 设计方案评审（视觉/交互）
- /plan-devex-review — 开发者体验评审（API/CLI/SDK）
- /cso — 安全审计 (OWASP Top 10 + STRIDE)

**编码验证:**
- /qa — 系统QA测试并修复bug (Quick/Standard/Exhaustive三级)
- /design-review — 视觉设计审计+修复 (6阶段方法)
- /investigate — 系统性Bug根因分析 (6阶段方法)
- /benchmark — 性能基线+Core Web Vitals

**发布部署:**
- /review — 预合并代码评审 (安全检查清单+自动修复)
- /ship — 全自动发布 (版本bump+CHANGLELOG+PR)
- /land-and-deploy — 合并+部署+金丝雀验证

**其他:**
- $B — 浏览器自动化 (100+命令)
- /browse — 浏览器技能入口

### aidlc-workflows 三阶段方法论
aidlc-rules 已安装在 `.aidlc/` 目录。
AI代理应遵循三阶段自适应工作流：
- INCEPTION: 需求分析、架构设计、用户故事
- CONSTRUCTION: 编码实现、测试、验证
- OPERATIONS: 部署、监控、运维

### matt-pocock skills (工程纪律技能包)
- /grill-with-docs — 需求细化 + 领域语言对齐
- /to-prd — 从上下文生成PRD
- /to-issues — 从PRD拆分为Issue
- /tdd — 测试驱动开发 (红-绿-重构)
- /triage — Issue状态机管理
- /diagnose — 系统性bug调试
- /handoff — 会话交接文档

### gstack-plus 统一工作流
运行 /gstack-plus-wf 启动完整工作流。
将自动检测范围，选择评审方案，依次执行所有阶段。

## 自动评审路由规则

运行 /gstack-plus-wf 时，根据输入特征自动判定：

| 输入特征 | 路由方案 | 自动决策 |
|---------|---------|---------|
| 新项目/大功能 (>20文件) | /autoplan (四阶段) | 机械问题自动 |
| 功能级 (5-20文件) | /plan-eng-review + 按需叠加 | 机械问题自动 |
| 小改动 (<5文件) | 跳过规划评审 → 直接编码 | 全部自动 |
| Bug修复 | /diagnose → 修复 | 全部自动 |
| 前端变化 | +/plan-design-review + /design-review + /benchmark | 机械问题自动 |
| 安全敏感 | +/cso + 安全检查项 | 机械问题自动 |
| API/CLI | +/plan-devex-review | 机械问题自动 |

## 项目文档约定

- docs/decisions/ — 决策记录 (DECISION-NNN.md, 固定模板)
- docs/prds/ — 产品需求文档 (PRD-NNN.md)
- docs/adr/ — 架构决策记录 (matt-skills ADR格式)
- docs/specs/ — 技术规格说明
- .gstack-plus/state.md — 工作流当前状态
- .gstack/sessions/ — gstack会话状态
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
| 规划评审 | 未使用gstack评审技能 | 自动路由: /autoplan→CEO→Design→Eng→DX | ✅ 新增 |
| 安全审计 | 未定义 | 自动检测敏感输入→/cso安全审计 | ✅ 新增 |
| 编码验证 | AutomationTester虚构类 | /qa三级测试 + /design-review六阶段 | ✅ 已有能力 |
| 系统调试 | 未定义 | /investigate六阶段根因分析 | ✅ 已有能力 |
| 性能测试 | 未定义 | /benchmark Core Web Vitals基线 | ✅ 已有能力 |
| 预合并评审 | 未定义 | /review完整安全检查清单+自动修复 | ✅ 新增 |
| 自动范围检测 | 无 | git diff自动分析→路由到最匹配的评审方案 | ✅ 新增 |
| 自动决策机制 | 无 | 6原则 (完整/煮沸/务实/DRY/显式/行动) | ✅ 继承autoplan |
| 决策分类 | 无 | 机械/品味/用户挑战三级分类 | ✅ 继承autoplan |
| 部署验证 | AutomationDeployer虚构类 | /ship + /land-and-deploy + /canary | ✅ 已有能力 |
| 决策落盘 | UnifiedDocManager TypeScript类 | 提示词约定 + state.md可见性 + 固定模板 | ✅ 可行 |
| MCP Server | 调用虚构API | 仅调用gstack CLI二进制 | ✅ 可行 |
| 工作流状态 | TypeScript状态机 | .gstack-plus/state.md文件 | ✅ 可行 |
| 安装方式 | git submodule | bash安装器脚本 | ✅ 可行 |
| 安全模型 | 未定义 | 利用gstack L1-L6安全层 | ✅ 已有能力 |
| 上游同步 | GitHub Action自动cherry-pick | 各自独立更新 | ✅ 避免耦合 |
| **整体可行性** | **31/100** | **94/100** | ✅ |

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

#### 3. 充分利用gstack已有能力 (v3.1新增)

```
规划评审:      /autoplan → /plan-ceo-review → /plan-eng-review → /plan-design-review → /plan-devex-review
安全审计:      /cso (OWASP Top 10 + STRIDE)
浏览器验证:    $B (100+命令，L1-L6安全层)
QA测试:        /qa (三级Tier，原子提交修复)
设计审计:      /design-review (六阶段，前后截图对比)
系统调试:      /investigate (六阶段根因分析)
性能基线:      /benchmark (Core Web Vitals)
预合并评审:    /review (完整安全检查清单+自动修复)
发布:          /ship (版本bump+CHANGELOG+PR)
部署+金丝雀:   /land-and-deploy + /canary
学习系统:      gbrain + learnings.jsonl
```

v3.1不再重新实现gstack已有的功能，而是通过统一工作流skill按阶段
**自动路由和编排**这些已有能力。

#### 4. aidlc-workflows的正确融入方式

aidlc-workflows的价值是其**三阶段方法论框架**，不是它的代码。v3.1将其融入统一工作流skill中：

```
INCEPTION 阶段 → 自动评审路由 (detect → route → execute)
                  + aidlc-workflows 规则文件作为方法论骨架
                  + gstack 评审技能作为执行引擎
                  + matt-skills grill/to-prd/to-issues 做需求细化

CONSTRUCTION 阶段 → matt-skills tdd 做编码纪律
                    + gstack $B 做浏览器验证
                    + gstack /qa + /design-review 做质量门
                    + gstack /investigate 做系统调试

OPERATIONS 阶段 → gstack /review (安全检查清单)
                  + gstack /benchmark (性能基线)
                  + gstack /ship + /land-and-deploy (发布部署)
                  + gstack /canary (生产监控)
                  + aidlc-workflows Operations 规则 (合规审计)
```

统一工作流skill按阶段告诉AI代理"参考哪份规则文件，检测什么范围，
路由到什么评审，执行哪些步骤"。

#### 5. 自动范围检测与评审路由 (v3.1最大增量价值)

```
用户输入 → git diff分析 → 特征提取
  ├── 文件数量 → 范围分类 (宏大/功能/增量/修复)
  ├── 文件类型 → 前端变化? 安全敏感? API? 数据库?
  └── 路由决策 → 自动选择评审方案 + 叠加规则

路由决策引擎规则表 (硬编码在SKILL.md中):

输入特征          → 评审方案                      → 自动决策级别
─────────────────────────────────────────────────────────────
新产品/大功能     → /autoplan (CEO→Design→Eng→DX)  → 机械:自动, 品味:打标
功能级+前端       → /plan-eng-review               → 机械:自动, 品味:打标
                  + /plan-design-review
                  + (Construction) /design-review
功能级+安全       → /plan-eng-review + /cso         → 安全项强制ASK
功能级+API        → /plan-eng-review                → 机械:自动
                  + /plan-devex-review
小改动            → 直接Construction                → 全部自动
Bug修复           → /investigate → Construction     → 全部自动
```

---

## 第五部分: 实施路线图

### Phase 1: 统一工作流skill (1天)

```
✅ 创建 gstack-plus-wf/SKILL.md
   ├── 范围检测+自动评审路由逻辑 (核心增量)
   ├── 三阶段工作流 (Inception→Construction→Operations)
   ├── gstack评审管线集成 (autoplan/ceo/eng/design/security/review/qa/ship/deploy/canary)
   ├── 自动决策6原则 (继承autoplan)
   ├── 强制决策落盘步骤
   └── 每阶段完成检查清单
✅ 创建 gstack-plus-install 安装脚本
✅ 创建 CLAUDE.md 生成器 (含完整技能路由表+自动路由规则)
✅ 原型验证：在一个真实项目上跑通3阶段全流程
```

### Phase 2: 状态管理 + 决策落盘 (1天)

```
✅ 定义 docs/decisions/ 固定模板 (含决策类型分类)
✅ 创建 .gstack-plus/state.md 管理约定
✅ 在统一工作流skill中加入"每阶段落盘"强制步骤
✅ 在最终审批门展示所有品味决策
✅ 验证多轮对话中状态持续可见
```

### Phase 3: MCP Server (可选, 2天)

```
✅ 开发独立MCP Server (只调用gstack CLI二进制)
✅ Windsurf/Cursor MCP配置
✅ 工具: workflow-status, decision-log, browser-session, review-dashboard
```

### Phase 4: 文档 + 发布 (1天)

```
✅ README.md 和安装指南
✅ 自动评审路由决策流程图
✅ 各评审技能的适用场景说明
✅ 发布到 GitHub
✅ 在1-2个真实项目上验证全管道
```

**总工作量**: 约1周（核心工作流）到2周（含MCP Server）

### 快速开始 (4步)

```bash
# 1. 安装 gstack-plus
curl -fsSL https://gstack-plus.dev/install | bash

# 2. 在项目中运行
cd your-project
gstack-plus-install

# 3. 在 Claude Code 中
/gstack-plus-wf

# 4. 工作流自动：
#    → 检测项目范围
#    → 选择路由评审方案
#    → 按阶段执行完整管道
#    → 自动决策+落盘
```

---

## 附录A: 三个项目代码审计发现的精要

### gstack (v1.39.0.0)

```
架构: Bun编译二进制 + Playwright Chromium守护进程
核心价值:
  ✅ 持久浏览器守护进程 (100-200ms命令延迟)
  ✅ 双端口安全架构 (本地 ↔ Tunnel隔离)
  ✅ L1-L6多层安全防御 (ML分类器 + Canary Token)
  ✅ 50+独立技能，分层组织:
     ├── 🏗️ 规划评审层: autoplan / plan-ceo-review / plan-eng-review
     │                    / plan-design-review / plan-devex-review
     ├── 🔒 安全审计层: cso (OWASP + STRIDE)
     ├── 🧪 编码验证层: qa / design-review / investigate / benchmark
     ├── 👁️ 预合并层: review (完整安全检查清单)
     ├── 🚀 发布部署层: ship / land-and-deploy / canary
     └── 🔧 支持层: gbrain / learnings / handoff / gstack-upgrade
  ✅ 多AI宿主适配器 (Claude/Codex/Cursor/Kiro等)
  ✅ 编译二进制部署 (无需Node.js/npm运行时)
  ✅ 完整的E2E测试体系 + LLM-judge评估
  ✅ 集成6原则自动决策系统 (autoplan)
  ✅ 评审技能间有依赖树和输出契约 (review dashboard)

代码状态: 活跃开发, 生产级成熟度
关键文件: browse/src/server.ts (核心守护进程), 
          browse/src/commands.ts (命令注册中心),
          browse/src/security.ts + security-classifier.ts (安全层),
          autoplan/SKILL.md.tmpl (6原则自动决策),
          review/SKILL.md.tmpl (安全检查清单),
          plan-eng-review/SKILL.md.tmpl (架构评审方法)
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