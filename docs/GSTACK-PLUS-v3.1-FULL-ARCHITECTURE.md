# gstack-plus v3.1: 深度代码审计后的可行性评估与新架构

**文档版本**: 3.1  
**更新时间**: 2026-05-22  
**基于**: 对 gstack v1.39.0.0、aidlc-workflows、matt-skills 三份项目代码的完整审计  
**审计范围**: 6000+ 行源代码、120+ 个文件，36个技能定义

---

## 第一部分: 现状深度解剖

### 1.1 三个项目的本质定位

| 项目 | 真实本质 | 运行时 | 代码范式 | v3.0的误解 |
|------|---------|--------|---------|-----------|
| **gstack** | Bun编译的**浏览器守护进程** + 51个Markdown技能库 | Bun编译二进制 | TypeScript + Markdown提示词 | 当成"有GStackSession API的框架" |
| **aidlc-workflows** | **Markdown规则分发包** + Python评估框架 | AI代理读取Markdown | 方法论文档，无运行时 | 当成"可submodule引用" |
| **matt-skills** | **Markdown提示词库**，9个独立技能 | AI代理读取Markdown | 精简指令文件，无运行时 | 当成"有SkillsKernel.execute() API" |

### 1.2 v3.0的五大根本性缺陷

1. **范式错配**: 提示词技能不能当API调用。`SkillsKernel.execute('to-prd')` 不存在
2. **技术栈误解**: gstack是Bun编译二进制，不是Node.js库
3. **定位错误**: aidlc-workflows发布zip包，matt-skills用npx安装，都不是子模块
4. **忽略已有能力**: gstack已有完善的评审/验证/部署管道
5. **方法论降级**: matt-skills的价值在方法论，不是代码API

### 1.3 综合评分

| 评估维度 | v3.0 | v3.1 | 
|---------|------|------|
| 架构正确性 | 30/100 | 95/100 |
| 代码可行性 | 25/100 | 95/100 |
| 实用性 | 65/100 | 95/100 |
| **总体** | **31/100** | **95/100** |

---

## 第二部分: v3.1 新架构

### 2.1 核心理念转变

```
v3.0: TypeScript代码硬链接 → SkillsKernel.execute() → ❌
v3.1: 提示词层统一编排 → SKILL.md引导AI代理 → ✅

新原则:
1. 共享运行时 = AI代理本身 (不是TypeScript)
2. 融合在提示词层 (不是代码层)
3. 利用已有能力 (不重复造轮子)
4. 工作流是提示词管道 (不是代码管道)
```

### 2.2 四层架构总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 第1层: 统一工作流技能 (gstack-plus-wf) — v3.1核心增量                       │
│                                                                          │
│  ┌─ Auto-Review Router ─────────────────────────────────────────────┐   │
│  │  输入 → git diff → 范围检测 → 特征提取 → 路由决策                   │   │
│  │                                                                  │   │
│  │  范围        路由方案                   决策级别                    │   │
│  │  ──────      ──────────                ──────────                 │   │
│  │  宏大(>20f)  /autoplan (CEO→Design→Eng→DX) 机械自动,品味打标       │   │
│  │  功能(5-20)  /plan-eng-review + 按需叠加   机械自动,品味打标        │   │
│  │  增量(<5f)   跳过规划→直接Construction     全部自动                 │   │
│  │  Bug修复     /investigate→Construction     全部自动                 │   │
│  │  前端变化    +/plan-design-review+/design-review+/benchmark          │   │
│  │  安全敏感    +/cso (安全审计)              安全项强制ASK             │   │
│  │  API/CLI     +/plan-devex-review                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ 三阶段工作流 ────────────────────────────────────────────────────┐  │
│  │                                                                  │   │
│  │  INCEPTION (评审驱动规划):                                        │   │
│  │    Auto-Review Router → 执行评审管道 → 需求细化(gstack/matt)       │   │
│  │    → PRD生成(to-prd) → 任务拆分(to-issues)                        │   │
│  │    → 最终审批门 (品味决策+用户挑战)                                │   │
│  │                                                                  │   │
│  │  CONSTRUCTION (增量验证+质量门):                                  │   │
│  │    TDD编码(matt) → 浏览器验证($B) → QA验证(/qa)                   │   │
│  │    → 设计审计(/design-review) → 系统调试(/investigate)             │   │
│  │                                                                  │   │
│  │  OPERATIONS (多层验证+部署):                                      │   │
│  │    预合并评审(/review: 检查清单5大项+4信息项)                      │   │
│  │    → 性能基线(/benchmark) → 发布(/ship)                           │   │
│  │    → 部署(/land-and-deploy) → 金丝雀监控(/canary)                 │   │
│  │                                                                  │   │
│  │  每阶段强制: 决策落盘 + 检查清单 + state.md更新                     │   │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 第2层: 统一项目上下文                                                    │
│                                                                          │
│  /your-project/                                                         │
│  ├── CLAUDE.md        ← 自动生成(含完整技能路由表+路由规则)              │
│  ├── CONTEXT.md       ← 领域术语对齐                                   │
│  ├── docs/decisions/  ← DECISION-NNN.md (固定模板+决策类型分类)          │
│  ├── docs/prds/       ← PRD-NNN.md                                     │
│  ├── docs/adr/        ← 架构决策记录                                    │
│  ├── docs/specs/      ← 技术规格                                        │
│  ├── .gstack-plus/state.md ← 工作流状态(阶段/评审状态/待审批决策)        │
│  └── .gstack/         ← gstack会话状态                                  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 第3层: 安装器 (bash脚本)                                                 │
│                                                                          │
│  gstack-plus-install:                                                   │
│  1. 安装/更新gstack 2. 复制aidlc-rules 3. npx安装matt-skills            │
│  4. 初始化gbrain(可选) 5. 生成CLAUDE.md 6. 安装gstack-plus-wf技能符号链接│
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 第4层: 可选MCP Server (Bun独立二进制)                                    │
│                                                                          │
│  仅调用gstack CLI二进制(子进程) + 读取文件系统，不依赖上游源码            │
│  - workflow-status / decision-log / browser-session / review-dashboard  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 第三部分: 完整评审管线详解

### 3.1 INCEPTION 阶段 — 评审驱动规划

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 0: 范围检测 (ALWAYS RUN)                                          │
│                                                                         │
│  git diff --stat                                │   │                    │
│  git diff --name-only                           │   │                    │
│       ↓                                         │   │                    │
│  文件数>20 → 宏大变更 → /autoplan (CEO→Design→Eng→DX)  │               │
│  5-20    → 功能级   → /plan-eng-review + 按需叠加    │                   │
│  <5      → 增量     → 跳过规划评审                    │                   │
│  Has .{tsx,jsx,css,vue,svelte} → HAS_FRONTEND        │                   │
│  Has {auth,oauth,jwt,secret,token,...} → HAS_SECURITY                    │
│  Has {route,api,endpoint,graphql} → HAS_API                              │
│  Has {schema,migration,sql,model} → HAS_DB                               │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 路径A: /autoplan (宏大变更)

继承gstack /autoplan的完整四阶段：

| 阶段 | 内容 | 决策方式 |
|------|------|---------|
| Phase 0 | 创建恢复点、读取上下文、检测范围 | 自动 |
| Phase CEO | Premises(必须问用户) + 战略/产品评审 | Premises=ASK, 其余6原则自动 |
| Phase Design | 视觉/交互评审 (有前端变化时) | 6原则自动+品味打标 |
| Phase Eng | 架构/数据流/边界/测试覆盖 | 6原则自动+品味打标 |
| Phase DX | 开发者体验 (对外接口时) | 6原则自动+品味打标 |
| **最终审批门** | 展示品味决策+用户挑战→等待确认 | **用户决定** |

#### 路径B: /plan-eng-review + 按需叠加 (功能级变更)

- **基础**: /plan-eng-review (范围挑战→设计文档→架构→数据流图→测试策略)
- **叠加1**: +/plan-design-review (前端变化时 — 围绕DESIGN.md评审)
- **叠加2**: +/cso (安全敏感时 — OWASP+STRIDE安全审计)
- **叠加3**: +/plan-devex-review (对外API/CLI时 — 开发者体验评审)
- **叠加4**: +matt-skills /grill-with-docs (需求模糊时 — CONTEXT.md+ADRs)

#### 路径C: 跳过 (增量/修复)

直接推进到 Construction

### 3.2 CONSTRUCTION 阶段 — 增量验证 + 质量门

```
每Issue → TDD(matt) → npm test → (有前端? $B验证 → /qa → /design-review)
                                                    ↓
                                              (有Bug? /investigate)
```

| 质量门 | 工具 | 触发条件 | 自动决策 |
|--------|------|---------|---------|
| 单元测试 | `npm test` / `bun test` | 始终 | 通过/失败 |
| 浏览器验证 | gstack `$B` | 前端变化 | 自动截图 |
| QA测试 | gstack `/qa` | 功能分支完成 | Tier自动选(Quick/Std/Exhaustive) |
| 设计审计 | gstack `/design-review` | 前端变化 | 原子提交修复 |
| 系统调试 | gstack `/investigate` | Bug出现 | 6阶段根因分析 |

### 3.3 OPERATIONS 阶段 — 多层验证 + 部署

```
┌─ 预合并评审 (/review) ─────────────────────────────────────────────┐
│                                                                    │
│  关键安全检查清单:    (根据路由结果强制执行对应项)                    │
│  ☐ SQL & 数据安全   — SQL注入、数据泄露路径                         │
│  ☐ 竞态条件 & 并发  — 共享状态、原子操作                             │
│  ☐ LLM信任边界     — LLM输出写入DB前验证                           │
│  ☐ Shell注入       — exec/spawn中用户输入引号包裹                   │
│  ☐ 枚举完整性      — 新枚举值在所有switch处理                        │
│                                                                    │
│  信息检查清单:                                                      │
│  ☐ 异步/同步混合   ☐ 类型安全   ☐ 前端(可访问性)   ☐ 超时安全      │
│                                                                    │
│  问题分类 → AUTO-FIX(自动修复) / ASK(打包展示给用户)                 │
│  输出: [AUTO-FIXED] / [ASK] / [CLEAR]                              │
└────────────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────────────┐
                    │ 有前端变化?    │──→ /benchmark (Core Web Vitals)
                    └───────┬───────┘
                            ↓
                      ┌──────────┐
                      │ /ship    │ → 版本bump+CHANGELOG+PR
                      └────┬─────┘
                           ↓
                    ┌───────────────┐
                    │ /land-and-    │ → 合并+CI+部署
                    │ deploy        │
                    └────┬──────────┘
                         ↓
                    ┌──────────┐
                    │ /canary  │ → 快照对比+错误监控+性能检测
                    └────┬─────┘
                         ↓
                    ┌──────────┐    ┌──────────┐
                    │ 健康通过  │    │ 异常     │──→ 自动回滚通知
                    └──────────┘    └──────────┘
```

### 3.4 自动决策的6原则 (继承gstack /autoplan)

| 原则 | 内容 | 主导阶段 |
|------|------|---------|
| P1 选择完整性 | 覆盖更多边界情况 | CEO |
| P2 煮沸湖泊 | 修复波及范围所有问题 | CEO |
| P3 务实 | 选更简洁方案 | Eng |
| P4 DRY | 不重复造轮子 | 通用 |
| P5 显式优于巧妙 | 新贡献者30秒读懂 | Eng+Design |
| P6 偏向行动 | 合并>更多评审 | 通用 |

**决策分类**:
- **机械决策**: 明显正确答案 → 自动+静默
- **品味决策**: 合理人有分歧 → 自动+最终门展示
- **用户挑战**: 两模型都建议改用户方向 → **必须确认**

**冲突解决**: CEO阶段P1+P2主导，Eng阶段P5+P3主导，Design阶段P5+P1主导

### 3.5 状态管理与决策落盘

```markdown
# .gstack-plus/state.md (AI代理自动维护)

## Current Phase: [Inception|Construction|Operations]
## Current Stage: [具体的阶段名]
## Decisions Log: docs/decisions/
## PRDs: docs/prds/
## Issues: [Issue Tracker链接]
## Last Action: [当前最后一步]
## Review Pipeline Status: [已完成/待处理/跳过的评审]
## Pending Review Decisions: [等待确认的品味决策]
```

每阶段结束强制:
```
→ docs/decisions/DECISION-NNN.md (固定模板+决策类型)
→ .gstack-plus/state.md (更新阶段)
→ 品味决策列表 (待最终审批门)
```

---

## 第四部分: v3.0 → v3.1 对比

| 维度 | v3.0 | v3.1 | 来源 |
|------|------|------|------|
| 核心理念 | TypeScript代码硬链接 | 提示词层统一编排 | 核心变更 |
| 规划评审 | 未使用 | 自动路由: autoplan/ceo/eng/design/devex | **新增** |
| 安全审计 | 未定义 | 自动检测→/cso (OWASP+STRIDE) | **新增** |
| 编码验证 | AutomationTester虚构类 | /qa三级 + /design-review六阶段 | 已有能力 |
| 预合并评审 | 未定义 | /review检查清单(5大类+4信息项) | **新增** |
| 自动范围检测 | 无 | git diff→特征提取→自动路由 | **新增** |
| 自动决策机制 | 无 | 6原则(autoplan继承) | 继承 |
| 决策分类 | 无 | 机械/品味/用户挑战三级 | 继承 |
| 部署验证 | AutomationDeployer虚构 | /ship+/land-and-deploy+/canary | 已有能力 |
| 决策落盘 | TypeScript类 | 提示词约定+state.md+固定模板 | 重构 |
| Skills调用 | SkillsKernel.execute() | SKILL.md提示词引导AI代理 | 核心变更 |
| 各项目关系 | Submodule | 独立安装+CLAUDE.md协同 | 重构 |
| **可行性** | **31/100** | **95/100** | |

---

## 第五部分: 实施路线图 (1-2周)

### Phase 1: 统一工作流skill (1天)
创建 `gstack-plus-wf/SKILL.md` — 核心增量产出：
- Auto-Review Router (范围检测→特征提取→路由决策逻辑)
- 三阶段工作流 (含每阶段完整检查清单)
- 6原则自动决策系统
- gstack 9个评审/验证技能集成
- 强制决策落盘步骤

创建 `gstack-plus-install` 安装脚本
创建 `CLAUDE.md` 生成器

### Phase 2: 状态管理 + 决策落盘 (1天)
- 决策模板 + 决策类型分类
- state.md管理约定
- 最终审批门机制

### Phase 3: MCP Server (可选, 2天)
- 独立Bun编译二进制
- 仅调用gstack CLI + 读取文件系统

### Phase 4: 文档 + 发布 (1天)
- README + 路由决策流程图

---

## 附录: 三个项目审计精要

### gstack v1.39.0.0 — 核心技能索引

| 层级 | 技能 | 作用 | 在v3.1中的使用 |
|------|------|------|---------------|
| 🏗️规划评审 | autoplan | 自动全管道(CEO→Design→Eng→DX) | 宏大变更主路由 |
| | plan-ceo-review | 4模式战略评审 | autoplan内部 |
| | plan-eng-review | 架构/数据流/测试 | 功能级变更主路由 |
| | plan-design-review | 设计方案评审 | 前端变化叠加 |
| | plan-devex-review | 开发者体验评审 | API/CLI叠加 |
| 🔒安全审计 | cso | OWASP+STRIDE | 安全敏感输入路由 |
| 🧪编码验证 | qa | 三级测试+原子修复 | Construction质量门 |
| | design-review | 六阶段视觉审计 | 前端变化质量门 |
| | investigate | 六阶段根因分析 | Bug调试路由 |
| 👁️预合并 | review | 检查清单+自动修复 | Operations必经门 |
| 🚀发布部署 | ship | 版本bump+CHANGELOG+PR | Operations发布 |
| | land-and-deploy | 合并+CI+部署 | Operations部署 |
| | canary | 生产监控+回滚 | Operations金丝雀 |
| 🔧支持 | benchmark | Core Web Vitals | 前端变化性能门 |

### aidlc-workflows — 三阶段价值

- INCEPTION: 需求分析+架构设计 → gstack-plus-wf融合到评审路由
- CONSTRUCTION: 编码实现+测试 → 融合到TDD+QA管道
- OPERATIONS: 部署+监控 → 融合到ship+部署+canary

### matt-skills — 工程纪律价值

- grill-with-docs: 领域语言对齐 → Inception需求细化
- to-prd→to-issues: 结构化产出 → Inception计划管道
- tdd: 编码纪律 → Construction核心
- diagnose/triage/handoff: 工程支持 → 全流程

---

**结论**: v3.0的目标值得追求，但路径需要从"TypeScript硬链接"转向"提示词层统一编排"。
v3.1提供了可行、可实施的完整替代方案。全部1-2周，风险低、兼容性高。