#!/usr/bin/env bun
/**
 * Omni Workflow MCP Server
 *
 * Exposes workflow state, PRDs, Issues, and Decisions as MCP tools.
 * Communicates over stdio using the Model Context Protocol.
 *
 * Tools:
 * - get_workflow_status   → read .omni-wf/state.md
 * - list_prds             → list .omni-wf/prds/*.md
 * - get_prd               → read a specific PRD file
 * - list_issues           → list .omni-wf/issues/*.md
 * - get_issue             → read a specific Issue file
 * - update_issue_status   → update an Issue's status
 * - log_decision          → write a decision file
 * - list_decisions        → list .omni-wf/decisions/*.md
 * - advance_phase         → move workflow to next phase
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
const PRDS_DIR = join(OMNI_DIR, "prds");
const ISSUES_DIR = join(OMNI_DIR, "issues");
const DECISIONS_DIR = join(OMNI_DIR, "decisions");

// Ensure dirs exist
[OMNI_DIR, PRDS_DIR, ISSUES_DIR, DECISIONS_DIR].forEach((d) => {
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

## Issues
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
    description: "列出所有本地 PRD 文件",
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
        id: { type: "string", description: "PRD ID，例如 PRD-001" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_issues",
    description: "列出所有本地 Issue 文件",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_issue",
    description: "读取指定 Issue 的完整内容",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Issue ID，例如 ISSUE-001" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_issue_status",
    description: "更新 Issue 的状态（OPEN / IN_PROGRESS / DONE）",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Issue ID" },
        status: {
          type: "string",
          enum: ["OPEN", "IN_PROGRESS", "DONE"],
        },
        note: { type: "string", description: "可选备注" },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "log_decision",
    description: "写入一条决策记录",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase: { type: "string", description: "所属阶段，如 THINK / PLAN / BUILD" },
        context: { type: "string", description: "决策背景" },
        decision: { type: "string", description: "最终决策" },
        consequences: { type: "string", description: "正面和负面影响" },
      },
      required: ["phase", "context", "decision"],
    },
  },
  {
    name: "list_decisions",
    description: "列出所有决策记录",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
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
      const issues = extractChecklistItems(state, "Issues");
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

    case "list_issues": {
      return { issues: listMdFiles(ISSUES_DIR) };
    }

    case "get_issue": {
      const file = join(ISSUES_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Issue not found", id: args.id };
      return { id: args.id, content: readFileSync(file, "utf-8") };
    }

    case "update_issue_status": {
      const file = join(ISSUES_DIR, args.id + ".md");
      if (!existsSync(file)) return { error: "Issue not found", id: args.id };
      let content = readFileSync(file, "utf-8");
      content = content.replace(
        /^## Status\s*\n.*$/m,
        `## Status\n${args.status}`
      );
      if (args.note) {
        content += `\n\n## Update Log\n- ${new Date().toISOString()}: ${args.note}\n`;
      }
      writeFileSync(file, content, "utf-8");
      return { success: true, id: args.id, status: args.status };
    }

    case "log_decision": {
      const count = existsSync(DECISIONS_DIR)
        ? readdirSync(DECISIONS_DIR).filter((f) => f.endsWith(".md")).length
        : 0;
      const id = `DECISION-${String(count + 1).padStart(3, "0")}`;
      const now = new Date().toISOString();
      const body = `# ${id}\n\n## Phase: ${args.phase}\n## Date: ${now}\n## Status: PENDING\n\n## Context\n${args.context}\n\n## Decision\n${args.decision}\n\n## Consequences\n${args.consequences || "(none recorded)"}\n`;
      writeFileSync(join(DECISIONS_DIR, id + ".md"), body, "utf-8");
      return { success: true, id, file: `${id}.md` };
    }

    case "list_decisions": {
      return { decisions: listMdFiles(DECISIONS_DIR) };
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
