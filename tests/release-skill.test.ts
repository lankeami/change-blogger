import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_PATH = resolve(__dirname, "../.claude/skills/release/SKILL.md");

describe("release skill", () => {
  it("exists at .claude/skills/release/SKILL.md", () => {
    expect(existsSync(SKILL_PATH)).toBe(true);
  });

  it("contains all 8 steps", () => {
    const content = readFileSync(SKILL_PATH, "utf-8");
    const stepMatches = content.match(/^## Step \d/gm);
    expect(stepMatches).toHaveLength(8);
  });

  it("uses package.json for version tracking", () => {
    const content = readFileSync(SKILL_PATH, "utf-8");
    expect(content).toContain("package.json");
    expect(content).not.toContain("Chart.yaml");
  });

  it("includes user confirmation stop before push", () => {
    const content = readFileSync(SKILL_PATH, "utf-8");
    expect(content.toLowerCase()).toContain("confirm");
    expect(content).toContain("STOP");
  });

  it("has frontmatter with name and description", () => {
    const content = readFileSync(SKILL_PATH, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toMatch(/name:\s*release/);
    expect(content).toMatch(/description:/);
  });

  it("groups commits by Add/Fix prefix", () => {
    const content = readFileSync(SKILL_PATH, "utf-8");
    expect(content).toContain("Features");
    expect(content).toContain("Bug Fixes");
  });
});
