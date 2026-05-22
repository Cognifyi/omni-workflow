#!/usr/bin/env bun
/**
 * Omni Workflow MCP Server
 *
 * Exposes workflow state, PRDs, Decisions, ADRs, Specs, and GitHub Issues
 * as MCP tools. Communicates over stdio using the Model Context Protocol.
 *
 * Tools:
 * - get_workflow_status    → read .omni-wf/state.md
 * - list_prds              → list docs/prds/*.md
 * - get_prd                → read a specific PRD file
 * - list_decisions         → list docs/decisions/*.md
 * - get_decision           → read a specific decision file
 * - log_decision           → write a decision file
 * - list_adrs              → list docs/adr/*.md
 * - get_adr                → read a specific ADR file
 * - list_specs             → list docs/specs/*.md
 * - get_spec               → read a specific spec file
 * - list_gh_issues         → list GitHub Issues with omni-wf label
 * - close_gh_issue         → close a GitHub Issue
 * - advance_phase          → move workflow to next phase
 *
 * Usage:
 *   bun mcp-server/src/server.ts
 *   # or after build:
 *   node mcp-server/dist/server.js
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";

// ─── Config ──────────────────────────────────────────────────────
const OMNI_DIR = ".omni-wf";
const STATE_FILE = join(OMNI_DIR, "state.md");
const PRDS_DIR = "docs/prds";
const DECISIONS_DIR = "docs/decisions";
const ADRS_DIR = "docs/adr";
const SPECS_DIR = "docs/specs";

// Ensure dirs exist
[OMNI_DIR, PRDS_DIR, DECISIONS_DIR, ADRS_DIR, SPECS_DIR].forEach((d) => {
  try {
    mkdirSync(d, { recursive: true });
  } catch {
    /* ignore */
  }
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
  const line = JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n";
  process.stdout.write(line);
}

function log(msg: string) {
  process.stderr.write("[omni-wf] " + msg + "\n");
}

// ─── State helpers ───────────────────────────────────────────────
function readState(): string {
  if (!existsSync(STATE_FILE)) {
    return initState();
  }
  return readFileSync(STATE_FILE, "utf-8");
}

function writeState(content: string) {
  writeFileSync(STATE_FILE, content, "utf-8");
}

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
- [ ] THINK
- [ ] PLAN
- [ ] ISSUES
- [ ] BUILD
- [ ] TEST
- [ ] SHIP

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
    const proc = Bun.spawnSync(["bash", "-c", cmd], {
      stdout: "pipe",
      stderr: "ignore",
    });
    return proc.stdout.toString().trim() || null;
  } catch {
    return null;
  }
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
  return match[1]
    .split("\n")
    .filter((l) => l.trim().startsWith("- ["))
    .map((l) => l.trim());
}

function updateDecisionIndex() {
  const decisions = listMdFiles(DECISIONS_DIR).filter((d) => d.file.startsWith("DECISION-"));
  const rows = decisions
    .map((d) => {
      const content = readFileSync(join(DECISIONS_DIR, d.file), "utf-8");
      const fm = parseFrontmatter(content);
      const phase = fm.Phase || "";
      const status = fm.Status || "";
      const date = fm.Date || "";
      const relatedPrd = fm["Related PRD"] || "";
      return `| ${d.id} | ${d.title} | ${phase} | ${status} | ${date} | ${relatedPrd} |`;
    })
    .join("\n");

  const index = `# 决策索引

## 活跃决策

| ID | 标题 | 阶段 | 状态 | 日期 | 关联 PRD |
|----|------|------|------|------|---------|
${rows}

## 已归档决策

（无已归档决策）

_本文件由 omni-wf 自动维护。请勿手动编辑。_
`;
  writeFileSync(join(DECISIONS_DIR, "README.md"), index, "utf-8");
}

// ─── Tool handlers ───────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_workflow_status",
    description: "读取当前工作流状态，返回结构化摘要",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_prds",
    description: "列出所有 PRD 文件 (docs/prds/)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_prd",
    description: "读取指定 PRD 的完整内容",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "PRD ID，例如 001-auth-system" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_decisions",
    description: "列出所有决策记录 (docs/decisions/)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_decision",
    description: "读取指定决策的完整内容",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Decision ID，例如 DECISION-001-use-jwt" },
      },
      required: ["id"],
    },
  },
  {
    name: "log_decision",
    description: "写入一条决策记录并自动更新索引",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase: { type: "string", description: "所属阶段，如 THINK / PLAN / BUILD" },
        context: { type: "string", description: "决策背景" },
        decision: { type: "string", description: "最终决策" },
        consequences: { type: "string", description: "正面和负面影响" },
        related_prd: { type: "string", description: "关联 PRD 路径（可选）" },
        title: { type: "string", description: "决策短标题（kebab-case）" },
      },
      required: ["phase", "context", "decision", "title"],
    },
  },
  {
    name: "list_adrs",
    description: "列出所有 ADR 文件 (docs/adr/)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_adr",
    description: "读取指定 ADR 的完整内容",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ADR ID，例如 ADR-001-cache-strategy" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_specs",
    description: "列出所有 Spec 文件 (docs/specs/)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_spec",
    description: "读取指定 Spec 的完整内容",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Spec ID，例如 SPEC-001-oauth-db-design" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_gh_issues",
    description: "列出带 omni-wf label 的 GitHub Issues",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Issue 状态过滤",
        },
      },
      required: [],
    },
  },
  {
    name: "close_gh_issue",
    description: "关闭一个 GitHub Issue",
    inputSchema: {
      type: "object" as const,
      properties: {
        number: { type: "number", description: "Issue 编号" },
        comment: { type: "string", description: "关闭评论（可选）" },
      },
      required: ["number"],
    },
  },
  {
    name: "advance_phase",
    description: "推进工作流到下一阶段",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          enum: ["THINK", "PLAN", "ISSUES", "BUILD", "TEST", "SHIP", "DONE"],
          description: "目标阶段",
        },
      },
      required: ["to"],
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
      return {
        phase: fm["Current Phase"] || fm.Phase || "IDLE",
        stage: fm["Current Stage"] || fm.Stage || "none",
        branch: fm.Branch || "unknown",
        startedAt: fm["Started At"] || "",
        lastUpdated: fm["Last Updated"] || "",
        prdCount: prds.length,
        issueCount: issues.length,
        completedPhases: completed.filter((l) => l.startsWith("- [x]")).map((l) => l.replace(/^- \[[xX]\] /, "")),
        raw: state,
      };
    }

    case "list_prds": {
      return { prds: listMdFiles(PRDS_DIR) };
    }

    case "get_prd": {
      const file = join(PRDS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "PRD not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_decisions": {
      return { decisions: listMdFiles(DECISIONS_DIR).filter((d) => d.file.startsWith("DECISION-")) };
    }

    case "get_decision": {
      const file = join(DECISIONS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Decision not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "log_decision": {
      const count = existsSync(DECISIONS_DIR)
        ? readdirSync(DECISIONS_DIR).filter((f) => f.startsWith("DECISION-") && f.endsWith(".md")).length
        : 0;
      const id = `DECISION-${String(count + 1).padStart(3, "0")}-${args.title}`;
      const now = new Date().toISOString();
      const relatedPrd = args.related_prd ? `\n## Related PRD\n${args.related_prd}\n` : "";
      const body = `# ${id}\n\n## Phase: ${args.phase}\n## Date: ${now}\n## Status: PENDING\n${relatedPrd}\n## Context\n${args.context}\n\n## Decision\n${args.decision}\n\n## Consequences\n${args.consequences || "(none recorded)"}\n`;
      writeFileSync(join(DECISIONS_DIR, id + ".md"), body, "utf-8");
      updateDecisionIndex();
      return { success: true, id, file: `${id}.md` };
    }

    case "list_adrs": {
      return { adrs: listMdFiles(ADRS_DIR).filter((d) => d.file.startsWith("ADR-")) };
    }

    case "get_adr": {
      const file = join(ADRS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "ADR not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_specs": {
      return { specs: listMdFiles(SPECS_DIR).filter((d) => d.file.startsWith("SPEC-")) };
    }

    case "get_spec": {
      const file = join(SPECS_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Spec not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "list_gh_issues": {
      const stateFilter = args.state || "all";
      const output = execSilently(`gh issue list --label omni-wf --state ${stateFilter} --json number,title,state,labels,url 2>/dev/null`) || "[]";
      try {
        return { issues: JSON.parse(output) };
      } catch {
        return { issues: [], raw: output };
      }
    }

    case "close_gh_issue": {
      const cmd = args.comment
        ? `gh issue close ${args.number} --comment "${args.comment.replace(/"/g, '\\"')}"`
        : `gh issue close ${args.number}`;
      const result = execSilently(cmd);
      if (result && result.toLowerCase().includes("error")) {
        return { success: false, error: result };
      }
      return { success: true, number: args.number, output: result };
    }

    case "advance_phase": {
      const state = readState();
      const phases = ["THINK", "PLAN", "ISSUES", "BUILD", "TEST", "SHIP", "DONE"];
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

      writeState(updated);
      return { success: true, from, to };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── MCP Lifecycle ───────────────────────────────────────────────
async function main() {
  log("Omni Workflow MCP Server starting (v0.1.0)");

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
      try {
        msg = JSON.parse(line);
      } catch {
        log("Malformed JSON: " + line.slice(0, 100));
        continue;
      }

      if (!msg.method) continue;

      switch (msg.method) {
        case "initialize": {
          send({
            id: msg.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "omni-wf", version: "0.1.0" },
            },
          });
          initialized = true;
          break;
        }

        case "notifications/initialized": {
          // no-op
          break;
        }

        case "tools/list": {
          if (!initialized) {
            send({ id: msg.id, error: { code: -32000, message: "Not initialized" } });
            break;
          }
          send({
            id: msg.id,
            result: { tools: TOOLS },
          });
          break;
        }

        case "tools/call": {
          if (!initialized) {
            send({ id: msg.id, error: { code: -32000, message: "Not initialized" } });
            break;
          }
          const { name, arguments: args = {} } = msg.params;
          try {
            const result = handleTool(name, args);
            send({
              id: msg.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
                isError: "error" in result,
              },
            });
          } catch (err: any) {
            send({
              id: msg.id,
              result: {
                content: [
                  { type: "text", text: `Error: ${err.message}` },
                ],
                isError: true,
              },
            });
          }
          break;
        }

        default: {
          send({
            id: msg.id,
            error: { code: -32601, message: `Method not found: ${msg.method}` },
          });
        }
      }
    }
  }

  log("Stdin closed. Shutting down.");
}

main().catch((e) => {
  log("Fatal: " + e.message);
  process.exit(1);
});
