# Omni Workflow — User Guide

## What this is for

Omni Workflow is a **self-driving development pipeline**. You describe what you want. The agent handles the rest: requirements clarification, architecture decisions, TDD implementation, code review, QA, security audit, and shipping.

**Best for:**

| Scenario | Why it works |
|----------|-------------|
| **Large feature from scratch** | INCEPTION prevents building the wrong thing; CONSTRUCTION's subagent isolation keeps context clean across thousands of lines |
| **Complex refactor** | Eng Review locks the target architecture before any code moves; per-Issue review catches regression risks |
| **MVP sprint** | `/office-hours` reframes the idea, `/autoplan` runs all reviews in one command, then TDD builds vertical slices fast |
| **Production hotfix** | Skips INCEPTION if state.md shows it's a pure CONSTRUCTION task; still enforces TDD + review before merge |
| **Multi-week project with interruptions** | `state.md` is a checkpoint system. `/context-save` before you leave, `/context-restore` when you're back. The agent resumes exactly where it stopped |
| **PRD audit before build** | `/prd-audit` reviews an existing PRD for bugs and improvements, lets you pick the fix scope, then splits into Issues and enters CONSTRUCTION |

**Not for:**
- One-line typo fixes (overhead exceeds value)
- Pure research or exploration without a shipping target
- Tasks where you want to hand-craft every line of code

---

## How to write prompts that unlock the full pipeline

The quality of the output depends on the quality of the input. The workflow's power comes from **structured delegation** — each phase has a specialist skill with specific expectations. Your job is to give that specialist enough context to make good decisions.

### Principle 1: Describe the problem, not the solution

Bad: "Add a JWT middleware to Express"
Good: "Users need to authenticate with email/password. The session should expire after 24h. We use Express on the backend and React on the frontend. Existing auth is basic HTTP auth and we want to replace it."

Why: `/office-hours` and `/plan-ceo-review` will interrogate the *problem*. If you pre-decide the solution, you skip the most valuable phase.

### Principle 2: State constraints and boundaries upfront

```
Build a notification system for our SaaS dashboard.

Constraints:
- Must support email, in-app, and Slack channels
- Users can toggle per-channel, per-event-type
- Existing stack: Next.js, Prisma, PostgreSQL, Resend for email
- Must not break existing real-time websocket feeds
- Timeline: ship in 3 days, so scope aggressively
```

Why: `/plan-eng-review` uses this to make architectural trade-offs. Without constraints, it over-engineers. With constraints, it picks the right depth.

### Principle 3: Accept the pipeline, don't fight it

The workflow is designed to be autonomous. If you interrupt every phase with "actually, skip this" or "just do it my way," you lose the value of the orchestration.

Good interaction pattern:
1. Give the initial prompt
2. Let `/office-hours` ask its 6 forcing questions
3. Answer them honestly
4. Let the pipeline run
5. Intervene only when the agent reports a blocker it cannot auto-correct

### Principle 4: Provide the starting state

```
I'm on branch feat/notification-v2. There are 12 changed files so far:
- src/lib/notifications/ (new directory, empty)
- src/app/api/webhooks/ (new endpoint stub)
- prisma/schema.prisma (added Notification table)

I ran `bun install` already. Tests pass on main.
```

Why: The preamble detects `HAS_FRONTEND`, `HAS_DB`, etc. from `git diff`. Explicit state prevents false detection and wrong routing.

### Principle 5: Scope expectations for subagent mode

If your project is large, explicitly tell the agent to use subagents:

```
This is a large task — I expect 20+ files changed and multiple vertical slices.
Please use subagent delegation for each Issue to keep context clean.
```

Why: The delegation rules are threshold-based, but explicit permission removes hesitation. The agent will parallelize where possible.

---

## Prompt examples

### Example 1: Large feature from scratch

```
Build a team invitation system for our SaaS product.

Current state:
- Next.js 14 App Router, Prisma, PostgreSQL
- Auth already exists (NextAuth.js with GitHub OAuth)
- No team/organization concept yet
- I need users to invite others by email, assign roles (admin/member/viewer)
- Invited users should land on an accept/reject page
- Role-based access control on existing dashboard routes

Expect this to touch 15+ files across frontend, API, and DB schema.
Please delegate each vertical slice to subagents.
```

**What happens:**
1. `/office-hours` reframes: "Is email invite the right channel? What about Slack/SSO?"
2. `/plan-ceo-review` decides scope: maybe start with email-only, admin/member, skip viewer
3. `/plan-eng-review` designs: new `Organization` model, `Membership` join table, middleware for role checks
4. `/to-issues` creates: "Org model + migration", "Invite API + email", "Accept flow", "Role middleware", "Dashboard RBAC"
5. Each Issue goes to a subagent for TDD → Review → Test
6. Main agent only sees: "Org model PASS, Invite API PASS..." and advances

---

### Example 2: Complex refactor with risk

```
Migrate our API layer from REST to tRPC.

Current state:
- 40+ REST endpoints under src/app/api/
- Frontend uses fetch with handwritten types (often drifted from backend)
- Tests are sparse on the API layer
- No breaking changes allowed — must ship incrementally

I want to do this endpoint-by-endpoint. Each migrated endpoint must have:
- tRPC router with Zod validation
- Type-safe frontend hook
- Unit test for the resolver
- Old REST route left as proxy during transition
```

**What happens:**
1. `/plan-eng-review` produces a SPEC: migration order (low-traffic first), proxy strategy, type sharing between server/client
2. `/to-issues` creates one Issue per endpoint cluster (auth, billing, data, etc.)
3. Each subagent handles one cluster: implements tRPC router, writes proxy, tests pass, old route untouched
4. Per-Issue `/review` catches: "You forgot to export the type for the frontend hook" or "Proxy doesn't forward query params"
5. Main agent tracks progress in `Subagent Queue` state.md

---

### Example 3: MVP sprint (fast path)

```
I need a working prototype in 2 days.

Idea: A Chrome extension that summarizes the current webpage with a keyboard shortcut (Cmd+Shift+S) and copies it to clipboard.

Stack: Plasmo framework, OpenAI API for summarization, no backend.
Constraints: Must work on Hacker News, GitHub READMEs, and blog posts. Summary should be 1-2 sentences.

Scope aggressively. Skip anything not essential for the demo.
```

**What happens:**
1. `/office-hours` quickly validates: "Is summarization the right hook? What about translation?" You confirm summarization.
2. `/plan-ceo-review` in SCOPE REDUCTION mode: strips to minimum viable feature set
3. `/plan-eng-review` locks: Plasmo manifest v3, content script extraction, background script API call, keyboard shortcut handler
4. `/to-prd` generates a 1-page PRD
5. `/to-issues` creates: "Extension scaffold + manifest", "Content script text extraction", "Background OpenAI integration", "Keyboard shortcut + clipboard"
6. Subagents execute in parallel (no dependencies between extraction and API integration)
7. `/ship` on day 2

---

### Example 4: Production hotfix (skip inception)

```
Users report 500 errors on the /api/billing/invoices endpoint.

Error log: "TypeError: Cannot read properties of undefined (reading 'subscription')"

I checked Sentry — it started 3 hours ago after the last deploy (commit 4a8f2c1).
That commit touched src/lib/billing/invoice.ts and src/app/api/billing/invoices/route.ts.

Fix it. Do not change anything unrelated. Keep the fix minimal.
```

**What happens:**
1. Preamble detects `Current Phase: CONSTRUCTION` (or IDLE with scope hint)
2. Agent skips INCEPTION (no new requirements needed)
3. `/investigate` on the commit diff: "`subscription` is destructured from `user` but `user` can be null for deleted accounts"
4. TDD: write a test with `user = null`, see RED
5. Fix: add null guard or early return
6. GREEN: test passes
7. `/review`: "Is this the minimal fix? Does it handle the edge case correctly?"
8. `/ship`: commit, push, open PR
9. No manual confirmation gates — auto-advance through each step

---

### Example 5: Multi-week project with interruption tolerance

```
Build a collaborative whiteboard with real-time cursors.

This is a 3-week project. I will be interrupted frequently.

High-level:
- Canvas-based drawing (Fabric.js or raw Canvas)
- WebSocket for real-time sync (PartyKit or Socket.io)
- Presence: cursor positions, user names, selection highlights
- History: undo/redo, persistent to PostgreSQL
- Export: PNG, SVG

Please save context before every major phase transition so I can resume later.
```

**What happens:**
1. Full INCEPTION over 2-3 sessions: `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review`
2. Agent runs `/context-save` after each sub-phase (stored in `.omni-wf/context-saves/`)
3. You return: agent detects saved context, offers `/context-restore`
4. CONSTRUCTION spans 10+ Issues: "Canvas drawing primitives", "WebSocket sync protocol", "Cursor presence", "Undo/redo system", "PNG export", "SVG export", "DB persistence layer"
5. Each Issue is a subagent. Main agent's context only holds: `Subagent Queue`, `Issue dependency graph`, `state.md`
6. After 3 weeks, `/ship` → `/land-and-deploy` → `/canary`

---

### Example 6: PRD audit entry (skip full INCEPTION)

```
I have a PRD at docs/prds/001-notification-system.md. Please audit it before we build.

The PRD was written by another team. I want to make sure it's complete and catch any bugs or risks before we start coding.
```

**What happens:**
1. `/prd-audit` loads the PRD from `docs/prds/001-notification-system.md`
2. **Completeness Check**: scores the PRD 0-10, flags missing sections (e.g. "Error Handling" and "NFR" missing)
3. **Bug/Risk Review**: discovers 2 HIGH risks ("no rate limiting on email API", "no fallback for Slack webhook failure") and 1 CRITICAL ("user preference table lacks unique constraint on user_id + channel")
4. **Improvement Review**: suggests P0 observability ("add delivery metrics") and P1 cost optimization ("batch email sends")
5. Agent presents summary and asks: Option A/B/C/D?
6. You choose **C** (fix all bugs + P0 improvements)
7. Agent revises the PRD in-place, saves audit report to `.omni-wf/prd-audits/AUDIT-001-notification-system.md`
8. `/to-issues` creates Issues: "Schema + migration", "Email delivery with rate limit", "Slack webhook with fallback", "Delivery metrics"
9. Agent initializes `state.md` with INCEPTION marked complete, enters CONSTRUCTION
10. Standard omni-wf CONSTRUCTION → TEST → SHIP continues

---

## Anti-patterns (what breaks the workflow)

| Anti-pattern | Why it breaks | What to do instead |
|-------------|-------------|-------------------|
| "Just write the code" | Skips INCEPTION → builds the wrong thing → rebuilds later | Let `/office-hours` ask its questions |
| "I know the architecture already" | Prevents `/plan-eng-review` from catching blind spots | State your draft architecture, let it stress-test |
| "Skip tests, I'll add them later" | Breaks TDD contract → review fails → workflow blocks | Accept TDD as part of the pipeline |
| "Can you do X and Y at the same time?" | Confuses the orchestrator's dependency tracking | One goal per session; the pipeline parallelizes automatically |
| Interrupting mid-phase with new requirements | Corrupts state.md evidence tracking | Finish the current phase, then start a new workflow for the new scope |

---

## Controlling the workflow mid-flight

Even though auto-advance is the default, you retain control:

```
# Pause and inspect state
Show me the current state.md. What phase are we in?

# Force a phase change (emergency only)
Skip INCEPTION. I already have a PRD at docs/prds/001-auth.md.

# Adjust subagent delegation
Don't use subagents for this small task. Execute directly.

# Inspect evidence
Show me the evidence for INCEPTION. Did we record all decisions?

# Resume from interruption
/context-restore
```

---

## 中文快速参考

| 场景 | 推荐输入方式 |
|------|------------|
| 从零开发大型功能 | 描述问题 + 约束 + 预期文件数 + "请用 subagent 委托" |
| 复杂重构 | 描述当前状态 + 目标架构 + "逐模块迁移，每个模块需测试" |
| MVP 快速验证 | 描述想法 + "2 天原型，激进裁剪范围" |
| 生产 hotfix | 错误信息 + 相关 commit + "只修复最小范围" |
| 多周项目 | 高层描述 + "我会频繁中断，请保存上下文" |
| 已有 PRD 审查后构建 | `/prd-audit docs/prds/001-xxx.md` → 按提示选择修复范围 |

完整工作流规范见 [omni-wf/SKILL.md](omni-wf/SKILL.md)。
