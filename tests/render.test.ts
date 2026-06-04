import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getTimeBucket,
  getRelativeDate,
  renderMarkdown,
  createRenderer,
} from "../src/render.js";

// ── Task 3: getTimeBucket ───────────────────────────────────────────────────

describe("getTimeBucket", () => {
  // Wednesday June 4, 2026 — ISO week starts Monday June 1
  const now = new Date("2026-06-04T12:00:00Z");

  it("returns 'this-week' for a release from the current ISO week", () => {
    expect(getTimeBucket("2026-06-02T10:00:00Z", now)).toBe("this-week");
  });

  it("returns 'this-week' for a release from today", () => {
    expect(getTimeBucket("2026-06-04T08:00:00Z", now)).toBe("this-week");
  });

  it("returns 'last-week' for a release from the previous ISO week", () => {
    expect(getTimeBucket("2026-05-27T10:00:00Z", now)).toBe("last-week");
  });

  it("returns 'older' for a release from two or more weeks ago", () => {
    expect(getTimeBucket("2026-05-15T10:00:00Z", now)).toBe("older");
  });

  it("returns 'this-week' for Monday 00:00 of the current week", () => {
    expect(getTimeBucket("2026-06-01T00:00:00Z", now)).toBe("this-week");
  });

  it("returns 'last-week' for Sunday end of previous week", () => {
    expect(getTimeBucket("2026-05-31T23:59:59Z", now)).toBe("last-week");
  });
});

// ── Task 3: getRelativeDate ─────────────────────────────────────────────────

describe("getRelativeDate", () => {
  const now = new Date("2026-06-04T12:00:00Z");

  it("returns 'today' for same-day releases", () => {
    expect(getRelativeDate("2026-06-04T08:00:00Z", now)).toBe("today");
  });

  it("returns 'yesterday' for previous-day releases", () => {
    expect(getRelativeDate("2026-06-03T10:00:00Z", now)).toBe("yesterday");
  });

  it("returns 'N days ago' for recent releases", () => {
    expect(getRelativeDate("2026-06-01T10:00:00Z", now)).toBe("3 days ago");
  });

  it("returns 'N weeks ago' for older releases", () => {
    expect(getRelativeDate("2026-05-18T10:00:00Z", now)).toBe("2 weeks ago");
  });

  it("returns formatted date for releases older than 30 days", () => {
    const result = getRelativeDate("2026-04-01T10:00:00Z", now);
    expect(result).toContain("Apr");
    expect(result).toContain("2026");
  });
});

// ── Task 4: renderMarkdown ──────────────────────────────────────────────────

describe("renderMarkdown", () => {
  it("converts bold markdown to HTML", () => {
    const result = renderMarkdown("**bold** text");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("converts code fences to code blocks", () => {
    const result = renderMarkdown("```js\nconsole.log('hi');\n```");
    expect(result).toContain("<code");
    expect(result).toContain("console.log");
  });

  it("converts markdown lists to HTML lists", () => {
    const result = renderMarkdown("- item one\n- item two");
    expect(result).toContain("<li>item one</li>");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

// ── Task 5: createRenderer ──────────────────────────────────────────────────

describe("createRenderer", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "render-test-"));
    writeFileSync(
      join(tmpDir, "layout.eta"),
      `<!DOCTYPE html><html><head><title><%= it.siteTitle %></title></head><body><%~ it.body %></body></html>`
    );
    writeFileSync(
      join(tmpDir, "greeting.eta"),
      `<h1>Hello <%= it.name %></h1>`
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("renders a body template wrapped in layout", () => {
    const renderer = createRenderer(tmpDir);
    const html = renderer.renderPage("greeting", {
      name: "World",
      siteTitle: "Test Site",
      pageTitle: "Greeting",
      basePath: "",
      repos: [],
      generatedAt: "2026-06-04",
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Test Site</title>");
    expect(html).toContain("<h1>Hello World</h1>");
    expect(html).toContain("</html>");
  });

  it("escapes HTML in data by default", () => {
    const renderer = createRenderer(tmpDir);
    const html = renderer.renderPage("greeting", {
      name: "<script>alert('xss')</script>",
      siteTitle: "Test",
      pageTitle: "Test",
      basePath: "",
      repos: [],
      generatedAt: "now",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
