/**
 * Omni Workflow Skill Validation Tests
 *
 * Validates the structure and content of SKILL.md
 * Ensures all required sections, constraints, and phase definitions are present.
 */

import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SKILL_PATH = join(import.meta.dir, "..", "omni-wf", "SKILL.md");
const skillContent = readFileSync(SKILL_PATH, "utf-8");

describe("SKILL.md structure", () => {
  it("has valid frontmatter", () => {
    expect(skillContent).toMatch(/^---\n/);
    expect(skillContent).toMatch(/name: omni-wf/);
    expect(skillContent).toMatch(/description: \|/);
    expect(skillContent).toMatch(/triggers:/);
  });

  it("has CRITICAL execution constraints section", () => {
    expect(skillContent).toMatch(/## CRITICAL.*执行约束/);
    expect(skillContent).toMatch(/禁止行为/);
    expect(skillContent).toMatch(/强制要求/);
    expect(skillContent).toMatch(/违规处理协议/);
  });

  it("has all 4 main phases defined", () => {
    expect(skillContent).toMatch(/## Phase 1: INCEPTION/);
    expect(skillContent).toMatch(/## Phase 2: CONSTRUCTION/);
    expect(skillContent).toMatch(/## Phase 3: TEST/);
    expect(skillContent).toMatch(/## Phase 4: SHIP/);
  });

  it("has all 5 INCEPTION sub-phases", () => {
    expect(skillContent).toMatch(/### 1\.1 Office Hours/);
    expect(skillContent).toMatch(/### 1\.2 CEO Review/);
    expect(skillContent).toMatch(/### 1\.3 Eng Review/);
    expect(skillContent).toMatch(/### 1\.4 Design Review/);
    expect(skillContent).toMatch(/### 1\.5 PRD Finalization/);
  });

  it("has CONSTRUCTION per-Issue review enforcement", () => {
    expect(skillContent).toMatch(/### 2\.3 Per-Issue Review/);
    expect(skillContent).toMatch(/\/review/);
    expect(skillContent).toMatch(/必须.*review/);
  });

  it("has phase transition gates", () => {
    expect(skillContent).toMatch(/阶段转换门/);
    expect(skillContent).toMatch(/强制验证清单/);
    expect(skillContent).toMatch(/阶段转换协议/);
  });

  it("has state.md template with Phase Completion Evidence", () => {
    expect(skillContent).toMatch(/Phase Completion Evidence/);
    expect(skillContent).toMatch(/INCEPTION Phase/);
    expect(skillContent).toMatch(/CONSTRUCTION Phase/);
    expect(skillContent).toMatch(/TEST Phase/);
    expect(skillContent).toMatch(/SHIP Phase/);
  });

  it("has no allowed-tools frontmatter (removed to avoid tool restriction)", () => {
    const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      expect(frontmatterMatch[1]).not.toMatch(/allowed-tools:/);
    }
  });
});
