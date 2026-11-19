import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getTimeBucket,
  getRelativeDate,
  renderMarkdown,
  createRenderer,
  renderUserPill,
  linkifyMentions,
  extractMentionLogins,
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

// ── Issue #20: renderUserPill ───────────────────────────────────────────────

describe("renderUserPill", () => {
  const user = {
    login: "octocat",
    name: "The Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    htmlUrl: "https://github.com/octocat",
  };

  it("renders a single anchor with class user-pill wrapping avatar and text", () => {
    const html = renderUserPill(user);
    expect(html.match(/<a\s/g)).toHaveLength(1);
    expect(html).toMatch(/^<a [^>]*class="user-pill"/);
    expect(html).toContain("<img");
    expect(html).toMatch(/<\/a>$/);
    // avatar and text both live inside the one anchor
    expect(html.indexOf("<img")).toBeGreaterThan(html.indexOf("<a "));
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("</a>"));
  });

  it("links the whole pill to the profile URL", () => {
    const html = renderUserPill(user);
    expect(html).toContain('href="https://github.com/octocat"');
  });

  it("shows the display name when available", () => {
    const html = renderUserPill(user);
    expect(html).toContain("The Octocat");
  });

  it("falls back to the login when no display name exists", () => {
    const html = renderUserPill({ ...user, name: null });
    expect(html).toContain(">octocat<");
  });

  it("always carries data-login", () => {
    expect(renderUserPill(user)).toContain('data-login="octocat"');
    expect(renderUserPill({ ...user, name: null })).toContain(
      'data-login="octocat"'
    );
  });

  it("carries data-name only when a display name exists", () => {
    expect(renderUserPill(user)).toContain('data-name="The Octocat"');
    expect(renderUserPill({ ...user, name: null })).not.toContain("data-name");
  });

  it("opens in a new tab with noopener noreferrer", () => {
    const html = renderUserPill(user);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("escapes HTML in name text and attributes", () => {
    const html = renderUserPill({ ...user, name: "O'Brien <script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/data-name="[^"]*<script>/);
  });

  it("sets avatar dimensions and lazy loading", () => {
    const html = renderUserPill(user);
    expect(html).toMatch(/<img[^>]*width="\d+"/);
    expect(html).toMatch(/<img[^>]*height="\d+"/);
    expect(html).toMatch(/<img[^>]*loading="lazy"/);
  });

  it("defaults avatar and profile URL from login when missing", () => {
    const html = renderUserPill({ login: "ghost" });
    expect(html).toContain('href="https://github.com/ghost"');
    expect(html).toContain('src="https://github.com/ghost.png');
  });
});

// ── Issue #20: linkifyMentions ──────────────────────────────────────────────

describe("linkifyMentions", () => {
  const users: Record<
    string,
    { login: string; name: string | null; avatarUrl: string; htmlUrl: string }
  > = {
    octocat: {
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
      htmlUrl: "https://github.com/octocat",
    },
    "dev-two": {
      login: "dev-two",
      name: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
      htmlUrl: "https://github.com/dev-two",
    },
  };
  const resolveUser = (login: string) => users[login] ?? null;

  it("transforms @login in text into a user pill", () => {
    const html = linkifyMentions("<p>Thanks @octocat for the fix</p>", resolveUser);
    expect(html).toContain('class="user-pill"');
    expect(html).toContain('data-login="octocat"');
    expect(html).toContain("The Octocat");
    expect(html).not.toContain("@octocat");
  });

  it("supports logins with internal hyphens", () => {
    const html = linkifyMentions("<p>cc @dev-two</p>", resolveUser);
    expect(html).toContain('data-login="dev-two"');
  });

  it("leaves mentions inside code blocks untouched", () => {
    const input = "<pre><code>git blame @octocat</code></pre>";
    expect(linkifyMentions(input, resolveUser)).toBe(input);
  });

  it("leaves mentions inside inline code untouched", () => {
    const input = "<p>run <code>@octocat/action</code> now</p>";
    expect(linkifyMentions(input, resolveUser)).toBe(input);
  });

  it("leaves mentions inside existing links untouched", () => {
    const input = '<p><a href="https://github.com/octocat">@octocat</a></p>';
    expect(linkifyMentions(input, resolveUser)).toBe(input);
  });

  it("does not transform email addresses", () => {
    const input = "<p>mail me at jay@octocat.com</p>";
    expect(linkifyMentions(input, resolveUser)).toBe(input);
  });

  it("renders a fallback pill when the resolver has no data", () => {
    const html = linkifyMentions("<p>by @unknownperson</p>", resolveUser);
    expect(html).toContain('data-login="unknownperson"');
    expect(html).toContain(">unknownperson<");
    expect(html).toContain('src="https://github.com/unknownperson.png');
  });

  it("transforms text after a skipped element", () => {
    const html = linkifyMentions(
      "<p><code>@octocat</code> and @octocat</p>",
      resolveUser
    );
    expect(html).toContain("<code>@octocat</code>");
    expect(html).toContain('data-login="octocat"');
  });
});

describe("extractMentionLogins", () => {
  it("collects mention logins outside code and links", () => {
    const html =
      '<p>Thanks @octocat and @dev-two, not <code>@skipme</code> or <a href="#">@linked</a></p>';
    expect(extractMentionLogins(html).sort()).toEqual(["dev-two", "octocat"]);
  });
});

// ── Issue #20: external links open in a new tab ─────────────────────────────

describe("renderMarkdown external links", () => {
  it("adds target and rel to absolute http(s) links", () => {
    const html = renderMarkdown("[GitHub](https://github.com) and [plain](http://example.com)");
    const anchors = html.match(/<a [^>]*>/g)!;
    expect(anchors.length).toBe(2);
    for (const a of anchors) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
  });

  it("leaves relative and anchor links alone", () => {
    const html = renderMarkdown("[rel](/docs/page) and [hash](#section)");
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("noopener");
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
