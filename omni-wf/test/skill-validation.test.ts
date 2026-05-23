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

const PRD_AUDIT_SKILL_PATH = join(import.meta.dir, "..", "prd-audit", "SKILL.md");
const prdAuditSkillContent = readFileSync(PRD_AUDIT_SKILL_PATH, "utf-8");

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
    expect(skillContent).toMatch(/### 2\.4 Per-Issue Review/);
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

describe("prd-audit SKILL.md structure", () => {
  it("has valid frontmatter", () => {
    expect(prdAuditSkillContent).toMatch(/^---\n/);
    expect(prdAuditSkillContent).toMatch(/name: prd-audit/);
    expect(prdAuditSkillContent).toMatch(/description: \|/);
    expect(prdAuditSkillContent).toMatch(/triggers:/);
  });

  it("has CRITICAL execution constraints section", () => {
    expect(prdAuditSkillContent).toMatch(/## CRITICAL.*执行约束/);
    expect(prdAuditSkillContent).toMatch(/禁止行为/);
    expect(prdAuditSkillContent).toMatch(/强制要求/);
  });

  it("has all 6 phases defined", () => {
    expect(prdAuditSkillContent).toMatch(/## Phase 0: PRD 获取/);
    expect(prdAuditSkillContent).toMatch(/## Phase 1: PRD 审查/);
    expect(prdAuditSkillContent).toMatch(/## Phase 2: 用户决策/);
    expect(prdAuditSkillContent).toMatch(/## Phase 3: PRD 修正/);
    expect(prdAuditSkillContent).toMatch(/## Phase 4: Issue 拆分/);
    expect(prdAuditSkillContent).toMatch(/## Phase 5: 接入 omni-wf/);
  });

  it("has three audit dimensions", () => {
    expect(prdAuditSkillContent).toMatch(/完整性检查/);
    expect(prdAuditSkillContent).toMatch(/Bug \/ 风险发现/);
    expect(prdAuditSkillContent).toMatch(/改进优化空间/);
  });

  it("has user choice options A-D", () => {
    expect(prdAuditSkillContent).toMatch(/A\. 【保守】/);
    expect(prdAuditSkillContent).toMatch(/B\. 【标准】/);
    expect(prdAuditSkillContent).toMatch(/C\. 【积极】/);
    expect(prdAuditSkillContent).toMatch(/D\. 【全面】/);
  });

  it("references omni-wf CONSTRUCTION phase", () => {
    expect(prdAuditSkillContent).toMatch(/CONSTRUCTION/);
    expect(prdAuditSkillContent).toMatch(/to-issues/);
  });

  it("has no allowed-tools frontmatter", () => {
    const frontmatterMatch = prdAuditSkillContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      expect(frontmatterMatch[1]).not.toMatch(/allowed-tools:/);
    }
  });
});
