#!/usr/bin/env bun
/**
 * Omni Workflow MCP Server v0.2.0
 *
 * Exposes workflow state, PRDs, Decisions, ADRs, Specs, GitHub Issues,
 * and per-Issue review/QA records as MCP tools.
 * Aligned to INCEPTION → CONSTRUCTION → TEST → SHIP phase model.
 * Communicates over stdio using the Model Context Protocol.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";

// ─── Config ──────────────────────────────────────────────────────
const OMNI_DIR = ".omni-wf";
const STATE_FILE = join(OMNI_DIR, "state.md");
const REVIEWS_DIR = join(OMNI_DIR, "reviews");
const PRDS_DIR = "docs/prds";
const DECISIONS_DIR = "docs/decisions";
const ADRS_DIR = "docs/adr";
const SPECS_DIR = "docs/specs";

// Ensure dirs exist
[OMNI_DIR, REVIEWS_DIR, PRDS_DIR, DECISIONS_DIR, ADRS_DIR, SPECS_DIR].forEach((d) => {
  try { mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
});

// ─── MCP Protocol helpers ────────────────────────────────────────
interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

function send(msg: Omit<JsonRpcMessage, "jsonrpc">) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
}
function log(msg: string) { process.stderr.write("[omni-wf] " + msg + "\n"); }

// ─── State helpers ───────────────────────────────────────────────
function readState(): string {
  if (!existsSync(STATE_FILE)) return initState();
  return readFileSync(STATE_FILE, "utf-8");
}
function writeState(content: string) { writeFileSync(STATE_FILE, content, "utf-8"); }

function initState(): string {
  const branch = execSilently("git branch --show-current") || "unknown";
  const now = new Date().toISOString();
  const tmpl = `# Omni Workflow State

## Current Phase: IDLE
## Current Stage: none
## Branch: ${branch}
## Started At: ${now}
## Last Updated: ${now}

## Completed Phases
- [ ] INCEPTION
- [ ] CONSTRUCTION
- [ ] TEST
- [ ] SHIP

## Phase Completion Evidence

### INCEPTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Sub-phases completed: [待记录]
- User Confirmation: [待确认]

### CONSTRUCTION Phase
- Completed At: [待完成]
- Evidence: [待记录]
- Issues completed: [N / total N]
- Per-Issue Review Status: [待记录]
- User Confirmation: [待确认]

### TEST Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

### SHIP Phase
- Completed At: [待完成]
- Evidence: [待记录]
- User Confirmation: [待确认]

## Pending Decisions
None

## PRDs
None

## GitHub Issues
None

## Notes
`;
  writeFileSync(STATE_FILE, tmpl, "utf-8");
  return tmpl;
}

function execSilently(cmd: string): string | null {
  try {
    const proc = Bun.spawnSync(["bash", "-c", cmd], { stdout: "pipe", stderr: "ignore" });
    return proc.stdout.toString().trim() || null;
  } catch { return null; }
}

function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split("\n");
  const out: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^##?\s*([^:\n]+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function listMdFiles(dir: string): Array<{ id: string; title: string; file: string }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = readFileSync(join(dir, f), "utf-8");
      const lines = content.split("\n");
      const titleLine = lines.find((l) => l.startsWith("# ")) || "";
      const title = titleLine.replace("# ", "").trim();
      return { id: basename(f, ".md"), title: title || f, file: f };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function extractChecklistItems(text: string, section: string): string[] {
  const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=## |\\z)`);
  const match = text.match(regex);
  if (!match) return [];
  return match[1].split("\n").filter((l) => l.trim().startsWith("- [")).map((l) => l.trim());
}

function extractSection(text: string, section: string): string {
  const regex = new RegExp(`### ${section} Phase\\n([\\s\\S]*?)(?=### |## |\\z)`);
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function updateDecisionIndex() {
  const decisions = listMdFiles(DECISIONS_DIR).filter((d) => d.file.startsWith("DECISION-"));
  const rows = decisions.map((d) => {
    const content = readFileSync(join(DECISIONS_DIR, d.file), "utf-8");
    const fm = parseFrontmatter(content);
    const source = fm["Sub-phase"] || fm.Phase || "";
    const status = fm.Status || "";
    const date = fm.Date || "";
    const relatedPrd = fm["Related PRD"] || "";
    return `| ${d.id} | ${d.title} | ${source} | ${status} | ${date} | ${relatedPrd} |`;
  }).join("\n");

  const index = `# 决策索引

## 活跃决策

| ID | 标题 | 来源 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
${rows}

## 已归档决策

（无已归档决策）

_本文件由 omni-wf 自动维护。请勿手动编辑。_
`;
  writeFileSync(join(DECISIONS_DIR, "README.md"), index, "utf-8");
}

function getReviewStats(): { total: number; passed: number; failed: number } {
  if (!existsSync(REVIEWS_DIR)) return { total: 0, passed: 0, failed: 0 };
  const files = readdirSync(REVIEWS_DIR).filter((f) => f.endsWith(".md"));
  let passed = 0, failed = 0;
  for (const f of files) {
    const content = readFileSync(join(REVIEWS_DIR, f), "utf-8");
    if (content.includes("Review Status: PASS")) passed++;
    else failed++;
  }
  return { total: files.length, passed, failed };
}

// ─── Tool handlers ───────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_workflow_status",
    description: "读取当前工作流结构化状态（含 review 统计）",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_prds",
    description: "列出所有 PRD 文件 (docs/prds/)",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_prd",
    description: "读取指定 PRD 的完整内容",
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "PRD ID，例如 001-auth-system" } }, required: ["id"] },
  },
  {
    name: "list_decisions",
    description: "列出所有决策记录 (docs/decisions/)",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_decision",
    description: "读取指定决策的完整内容",
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "Decision ID，例如 DECISION-001-office-hours-use-jwt" } }, required: ["id"] },
  },
  {
    name: "log_decision",
    description: "写入一条决策记录并自动更新索引",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase: { type: "string", description: "所属阶段，如 INCEPTION / CONSTRUCTION / TEST / SHIP" },
        sub_phase: { type: "string", description: "子阶段，如 office-hours / ceo-review / eng-review / design-review" },
        context: { type: "string", description: "决策背景" },
        decision: { type: "string", description: "最终决策" },
        consequences: { type: "string", description: "正面和负面影响" },
        related_prd: { type: "string", description: "关联 PRD 路径（可选）" },
        title: { type: "string", description: "决策短标题（kebab-case）" },
      },
      required: ["phase", "sub_phase", "context", "decision", "title"],
    },
  },
  {
    name: "list_adrs",
    description: "列出所有 ADR 文件 (docs/adr/)",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_adr",
    description: "读取指定 ADR 的完整内容",
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "ADR ID，例如 ADR-001-cache-strategy" } }, required: ["id"] },
  },
  {
    name: "list_specs",
    description: "列出所有 Spec 文件 (docs/specs/)",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_spec",
    description: "读取指定 Spec 的完整内容",
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "Spec ID，例如 SPEC-001-oauth-db-design" } }, required: ["id"] },
  },
  {
    name: "list_gh_issues",
    description: "列出带 omni-wf label 的 GitHub Issues",
    inputSchema: { type: "object" as const, properties: { state: { type: "string", enum: ["open", "closed", "all"], description: "Issue 状态过滤" } }, required: [] },
  },
  {
    name: "close_gh_issue",
    description: "关闭一个 GitHub Issue",
    inputSchema: { type: "object" as const, properties: { number: { type: "number", description: "Issue 编号" }, comment: { type: "string", description: "关闭评论（可选）" } }, required: ["number"] },
  },
  {
    name: "log_review",
    description: "写入一条 per-Issue review/QA/test 记录到 .omni-wf/reviews/",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_number: { type: "number", description: "GitHub Issue 编号" },
        review_status: { type: "string", enum: ["PASS", "FAIL", "PENDING"], description: "/review 结果" },
        review_output: { type: "string", description: "/review 输出摘要" },
        qa_status: { type: "string", enum: ["PASS", "FAIL", "N/A"], description: "/qa 结果" },
        qa_output: { type: "string", description: "/qa 输出摘要（可选）" },
        test_status: { type: "string", enum: ["PASS", "FAIL"], description: "项目测试状态" },
        test_output: { type: "string", description: "测试输出摘要" },
      },
      required: ["issue_number", "review_status", "test_status"],
    },
  },
  {
    name: "list_reviews",
    description: "列出所有 review 记录 (.omni-wf/reviews/)",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_review",
    description: "读取指定 review 记录的完整内容",
    inputSchema: { type: "object" as const, properties: { issue_number: { type: "number", description: "GitHub Issue 编号" } }, required: ["issue_number"] },
  },
  {
    name: "validate_phase_transition",
    description: "验证当前阶段是否可以推进到下一阶段（检查 evidence、reviews 等）",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", enum: ["INCEPTION", "CONSTRUCTION", "TEST", "SHIP"], description: "当前阶段" },
        to: { type: "string", enum: ["INCEPTION", "CONSTRUCTION", "TEST", "SHIP", "DONE"], description: "目标阶段" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "advance_phase",
    description: "推进工作流到下一阶段（必须提供 evidence）",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", enum: ["INCEPTION", "CONSTRUCTION", "TEST", "SHIP", "DONE"], description: "目标阶段" },
        evidence: { type: "string", description: "阶段完成证据描述（强制要求，最少 10 字符）" },
      },
      required: ["to", "evidence"],
    },
  },
];

function handleTool(name: string, args: any): any {
  switch (name) {
    case "get_workflow_status": {
      const state = readState();
      const fm = parseFrontmatter(state);
      const prds = extractChecklistItems(state, "PRDs");
      const issues = extractChecklistItems(state, "GitHub Issues");
      const completed = extractChecklistItems(state, "Completed Phases");
      const reviewStats = getReviewStats();
      return {
        phase: fm["Current Phase"] || fm.Phase || "IDLE",
        stage: fm["Current Stage"] || fm.Stage || "none",
        branch: fm.Branch || "unknown",
        startedAt: fm["Started At"] || "",
        lastUpdated: fm["Last Updated"] || "",
        prdCount: prds.length,
        issueCount: issues.length,
        completedPhases: completed.filter((l) => l.startsWith("- [x]")).map((l) => l.replace(/^- \[[xX]\] /, "")),
        reviewStats,
        raw: state,
      };
    }

    case "list_prds": return { prds: listMdFiles(PRDS_DIR) };

    case "get_prd": {
      const file = join(PRDS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "PRD not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_decisions": return { decisions: listMdFiles(DECISIONS_DIR).filter((d) => d.file.startsWith("DECISION-")) };

    case "get_decision": {
      const file = join(DECISIONS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Decision not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "log_decision": {
      const count = existsSync(DECISIONS_DIR)
        ? readdirSync(DECISIONS_DIR).filter((f) => f.startsWith("DECISION-") && f.endsWith(".md")).length
        : 0;
      const subPhasePrefix = args.sub_phase ? `${args.sub_phase}-` : "";
      const id = `DECISION-${String(count + 1).padStart(3, "0")}-${subPhasePrefix}${args.title}`;
      const now = new Date().toISOString();
      const relatedPrd = args.related_prd ? `\n## Related PRD\n${args.related_prd}\n` : "";
      const body = `# ${id}\n\n## Phase: ${args.phase}\n## Sub-phase: ${args.sub_phase}\n## Date: ${now}\n## Status: PENDING\n${relatedPrd}\n## Context\n${args.context}\n\n## Decision\n${args.decision}\n\n## Consequences\n${args.consequences || "(none recorded)"}\n`;
      writeFileSync(join(DECISIONS_DIR, id + ".md"), body, "utf-8");
      updateDecisionIndex();
      return { success: true, id, file: `${id}.md` };
    }

    case "list_adrs": return { adrs: listMdFiles(ADRS_DIR).filter((d) => d.file.startsWith("ADR-")) };

    case "get_adr": {
      const file = join(ADRS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "ADR not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_specs": return { specs: listMdFiles(SPECS_DIR).filter((d) => d.file.startsWith("SPEC-")) };

    case "get_spec": {
      const file = join(SPECS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Spec not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_gh_issues": {
      const stateFilter = args.state || "all";
      const output = execSilently(`gh issue list --label omni-wf --state ${stateFilter} --json number,title,state,labels,url 2>/dev/null`) || "[]";
      try { return { issues: JSON.parse(output) }; } catch { return { issues: [], raw: output }; }
    }

    case "close_gh_issue": {
      const cmd = args.comment
        ? `gh issue close ${args.number} --comment "${args.comment.replace(/"/g, '\\"')}"`
        : `gh issue close ${args.number}`;
      const result = execSilently(cmd);
      if (result && result.toLowerCase().includes("error")) return { success: false, error: result };
      return { success: true, number: args.number, output: result };
    }

    case "log_review": {
      const now = new Date().toISOString();
      const reviewFile = join(REVIEWS_DIR, `issue-${args.issue_number}.md`);
      const body = `# Review Record: Issue #${args.issue_number}\n\n## Date: ${now}\n\n## Review Status: ${args.review_status}\n## Review Output\n${args.review_output || "(none recorded)"}\n\n## QA Status: ${args.qa_status || "N/A"}\n## QA Output\n${args.qa_output || "(none recorded)"}\n\n## Test Status: ${args.test_status}\n## Test Output\n${args.test_output || "(none recorded)"}\n\n## Overall: ${args.review_status === "PASS" && (args.qa_status === "PASS" || args.qa_status === "N/A") && args.test_status === "PASS" ? "PASS" : "FAIL"}\n`;
      writeFileSync(reviewFile, body, "utf-8");
      return { success: true, issue_number: args.issue_number, file: `issue-${args.issue_number}.md` };
    }

    case "list_reviews": return { reviews: listMdFiles(REVIEWS_DIR) };

    case "get_review": {
      const file = join(REVIEWS_DIR, `issue-${args.issue_number}.md`);
      if (!existsSync(file)) return { error: "Review record not found", issue_number: args.issue_number };
      return { issue_number: args.issue_number, content: readFileSync(file, "utf-8") };
    }

    case "validate_phase_transition": {
      const state = readState();
      const from = args.from;
      const to = args.to;
      const errors: string[] = [];

      if (!state.includes(`- [x] ${from}`)) {
        errors.push(`Phase ${from} is not marked as completed in state.md`);
      }

      const evidenceSection = extractSection(state, from);
      if (!evidenceSection || evidenceSection.includes("[待完成]") || evidenceSection.includes("[待记录]")) {
        errors.push(`Phase ${from} completion evidence is missing or incomplete`);
      }

      if (from === "CONSTRUCTION") {
        const reviewStats = getReviewStats();
        if (reviewStats.total === 0) errors.push("CONSTRUCTION phase: no review records found in .omni-wf/reviews/");
        if (reviewStats.failed > 0) errors.push(`CONSTRUCTION phase: ${reviewStats.failed} review(s) failed`);
      }

      if (from === "TEST") {
        const testEvidence = extractSection(state, "TEST");
        if (!testEvidence.includes("PASS")) errors.push("TEST phase: no PASS evidence found in test results");
      }

      if (errors.length > 0) return { valid: false, errors, from, to };
      return { valid: true, errors: [], from, to, message: "Phase transition validated. User confirmation still required." };
    }

    case "advance_phase": {
      if (!args.evidence || args.evidence.trim().length < 10) {
        return { error: "advance_phase requires 'evidence' field (min 10 chars). Describe what was completed in this phase." };
      }

      const state = readState();
      const phases = ["INCEPTION", "CONSTRUCTION", "TEST", "SHIP", "DONE"];
      const fromMatch = state.match(/^## Current Phase:\s*(.*)$/m);
      const from = fromMatch ? fromMatch[1].trim() : "IDLE";
      const to = args.to;

      let updated = state
        .replace(/^## Current Phase:.*$/m, `## Current Phase: ${to}`)
        .replace(/^## Last Updated:.*$/m, `## Last Updated: ${new Date().toISOString()}`);

      if (phases.includes(to)) {
        const regex = new RegExp(`^(\\s*- \\[ \\]) ${to}$`, "m");
        updated = updated.replace(regex, `- [x] ${to}`);
      }

      const evidenceRegex = new RegExp(`(### ${from} Phase[\\s\\S]*?## User Confirmation: ).*?$`, "m");
      updated = updated.replace(evidenceRegex, `$1Approved via advance_phase. Evidence: ${args.evidence.replace(/"/g, "'")}`);

      writeState(updated);
      return { success: true, from, to, evidence: args.evidence };
    }

    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── MCP Lifecycle ───────────────────────────────────────────────
async function main() {
  log("Omni Workflow MCP Server starting (v0.2.0)");

  let initialized = false;
  let buffer = "";

  for await (const chunk of Bun.stdin.stream()) {
    buffer += new TextDecoder().decode(chunk);

    let nlIndex;
    while ((nlIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nlIndex).trim();
      buffer = buffer.slice(nlIndex + 1);
      if (!line) continue;

      let msg: JsonRpcMessage;
      try { msg = JSON.parse(line); } catch { log("Malformed JSON: " + line.slice(0, 100)); continue; }
      if (!msg.method) continue;

      switch (msg.method) {
        case "initialize": {
          send({
            id: msg.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "omni-wf", version: "0.2.0" },
            },
          });
          initialized = true;
          break;
        }

        case "notifications/initialized": break;

        case "tools/list": {
          if (!initialized) { send({ id: msg.id, error: { code: -32000, message: "Not initialized" } }); break; }
          send({ id: msg.id, result: { tools: TOOLS } });
          break;
        }

        case "tools/call": {
          if (!initialized) { send({ id: msg.id, error: { code: -32000, message: "Not initialized" } }); break; }
          const { name, arguments: args = {} } = msg.params;
          try {
            const result = handleTool(name, args);
            send({ id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: "error" in result } });
          } catch (err: any) {
            send({ id: msg.id, result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true } });
          }
          break;
        }

        default: send({ id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
      }
    }
  }

  log("Stdin closed. Shutting down.");
}

main().catch((e) => { log("Fatal: " + e.message); process.exit(1); });
