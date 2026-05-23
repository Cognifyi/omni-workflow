/**
 * Omni Workflow MCP Server Unit Tests
 *
 * Tests the MCP Server's tool registration, state management, and phase transition logic.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// We test the server by spawning it as a child process and sending JSON-RPC messages
async function spawnServer(cwd: string): Promise<{ send: (msg: any) => void; read: () => Promise<any[]>; kill: () => void }> {
  const proc = Bun.spawn({
    cmd: ["bun", join(import.meta.dir, "..", "mcp-server", "src", "server.ts")],
    cwd,
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, NODE_ENV: "test" },
  });

  const decoder = new TextDecoder();
  let buffer = "";
  const messages: any[] = [];
  let resolveRead: (msgs: any[]) => void;
  let readPromise = new Promise<any[]>((r) => { resolveRead = r; });

  (async () => {
    for await (const chunk of proc.stdout) {
      buffer += decoder.decode(chunk);
      let nlIndex;
      while ((nlIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nlIndex).trim();
        buffer = buffer.slice(nlIndex + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          messages.push(msg);
          if (resolveRead) {
            resolveRead([...messages]);
            readPromise = new Promise<any[]>((r) => { resolveRead = r; });
          }
        } catch { /* ignore malformed */ }
      }
    }
  })();

  return {
    send: (msg: any) => {
      proc.stdin.write(JSON.stringify(msg) + "\n");
    },
    read: async () => {
      // Wait a bit for messages to arrive
      await new Promise((r) => setTimeout(r, 200));
      return [...messages];
    },
    kill: () => {
      proc.kill();
    },
  };
}

describe("MCP Server", () => {
  let tmpDir: string;
  let server: { send: (msg: any) => void; read: () => Promise<any[]>; kill: () => void };

  it("initializes and lists 20 tools", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "omni-wf-test-"));
    mkdirSync(join(tmpDir, ".omni-wf"), { recursive: true });
    mkdirSync(join(tmpDir, "docs", "prds"), { recursive: true });
    mkdirSync(join(tmpDir, "docs", "decisions"), { recursive: true });
    mkdirSync(join(tmpDir, "docs", "adr"), { recursive: true });
    mkdirSync(join(tmpDir, "docs", "specs"), { recursive: true });

    server = await spawnServer(tmpDir);

    server.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0.1" } } });
    server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    server.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

    const msgs = await server.read();
    const initRes = msgs.find((m) => m.id === 1);
    expect(initRes?.result?.serverInfo?.name).toBe("omni-wf");

    const listRes = msgs.find((m) => m.id === 2);
    expect(listRes?.result?.tools?.length).toBe(20);

    const toolNames = listRes?.result?.tools?.map((t: any) => t.name);
    expect(toolNames).toContain("get_workflow_status");
    expect(toolNames).toContain("log_review");
    expect(toolNames).toContain("validate_phase_transition");
    expect(toolNames).toContain("advance_phase");
    expect(toolNames).toContain("audit_prd");
    expect(toolNames).toContain("get_prd_audit");
    expect(toolNames).toContain("list_prd_audits");
  });

  it("get_workflow_status returns IDLE for fresh state", async () => {
    server.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_workflow_status", arguments: {} } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 3);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.phase).toBe("IDLE");
    expect(result.reviewStats).toEqual({ total: 0, passed: 0, failed: 0 });
  });

  it("advance_phase without evidence is rejected", async () => {
    server.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "advance_phase", arguments: { to: "INCEPTION" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 4);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.error).toContain("evidence");
  });

  it("advance_phase with evidence succeeds", async () => {
    server.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "advance_phase", arguments: { to: "INCEPTION", evidence: "THINK phase completed: scope detected, routing decided, decisions logged" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 5);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.success).toBe(true);
    expect(result.to).toBe("INCEPTION");
  });

  it("validate_phase_transition detects missing evidence", async () => {
    server.send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "validate_phase_transition", arguments: { from: "INCEPTION", to: "CONSTRUCTION" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 6);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("log_decision creates file and updates index", async () => {
    server.send({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "log_decision", arguments: { phase: "INCEPTION", sub_phase: "office-hours", context: "Test context", decision: "Use JWT", title: "use-jwt" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 7);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.success).toBe(true);
    expect(result.id).toContain("DECISION-001-office-hours-use-jwt");

    // Check index was created
    const indexPath = join(tmpDir, "docs", "decisions", "README.md");
    const indexContent = readFileSync(indexPath, "utf-8");
    expect(indexContent).toContain("use-jwt");
  });

  it("audit_prd creates audit file", async () => {
    server.send({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "audit_prd", arguments: { prd_id: "001-auth-system", completeness_score: 7, missing_sections: "- NFR\n- Error Handling", bug_findings: "### HIGH\n1. Missing rate limit", improvement_opportunities: "### P0\n1. Add observability", verdict: "需修复后拆分", user_choice: "C" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 8);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.success).toBe(true);
    expect(result.prd_id).toBe("001-auth-system");
  });

  it("list_prd_audits returns created audits", async () => {
    server.send({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "list_prd_audits", arguments: {} } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 9);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.audits?.length).toBeGreaterThanOrEqual(1);
    expect(result.audits?.[0]?.id).toBe("001-auth-system");
  });

  it("get_prd_audit returns audit content", async () => {
    server.send({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "get_prd_audit", arguments: { prd_id: "001-auth-system" } } });
    await new Promise((r) => setTimeout(r, 300));
    const msgs = await server.read();
    const res = msgs.find((m) => m.id === 10);
    const result = JSON.parse(res?.result?.content?.[0]?.text || "{}");
    expect(result.prd_id).toBe("001-auth-system");
    expect(result.content).toContain("7/10");
  });

  afterAll(() => {
    if (server) server.kill();
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });
});
