# Phase 2: HTML Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a branded static HTML site from the releases JSON produced by Phase 1.

**Architecture:** A new `src/generate.ts` entry point reads `data/releases.json` and uses Eta templates + marked markdown to produce `site/index.html` (time-bucketed aggregate feed) and `site/{repo}/index.html` (per-repo chronological pages). A `src/render.ts` module encapsulates Eta/marked config and date/template helpers.

**Tech Stack:** TypeScript (ES2022, Node16 modules), Eta (templates), marked (markdown), vitest (testing)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add eta, marked, vitest deps; update scripts |
| `src/config.ts` | Modify | Remove token requirement (generate doesn't need it) |
| `src/fetch.ts` | Modify | Add token validation before use |
| `src/types.ts` | Modify | Add template data interfaces |
| `src/render.ts` | Create | Eta/marked config, date helpers, renderPage |
| `src/generate.ts` | Modify (replace placeholder) | Entry point: read JSON, orchestrate rendering, write HTML |
| `templates/layout.eta` | Create | Shared HTML shell (head, nav, footer, body slot) |
| `templates/index.eta` | Create | Index page body (time-bucketed release cards) |
| `templates/repo.eta` | Create | Repo page body (chronological release list) |
| `templates/style.css` | Create | Branded stylesheet |
| `tests/render.test.ts` | Create | Unit tests for render helpers |
| `tests/generate.test.ts` | Create | Integration tests for site generation |

---

### Task 1: Project setup — add dependencies and test framework

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

Run: `npm install eta marked`

- [ ] **Step 2: Install test framework**

Run: `npm install --save-dev vitest`

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 4: Verify setup**

Run: `npx vitest run`
Expected: vitest runs and reports "no test files found" (no tests yet). Exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add eta, marked, and vitest dependencies"
```

---

### Task 2: Refactor config — make GitHub token optional

The `generate` script doesn't need a GitHub token. Currently `getConfig()` throws if no token is found. Move the token validation into `fetch.ts` so both scripts can share the same config loader.

**Files:**
- Modify: `src/config.ts:21-28`
- Modify: `src/fetch.ts:9`

- [ ] **Step 1: Remove token validation from getConfig**

In `src/config.ts`, replace lines 21-28:

```typescript
  const token =
    (raw.githubToken as string | undefined) || process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GitHub token required. Set 'githubToken' in config.json or GITHUB_TOKEN env var."
    );
  }
```

With:

```typescript
  const token =
    (raw.githubToken as string | undefined) || process.env.GITHUB_TOKEN;
```

And in the return statement, change `githubToken: token,` to `githubToken: token,` (no change needed — it's already optional in the Config interface, and `token` may now be `undefined`).

- [ ] **Step 2: Add token validation to fetch.ts**

In `src/fetch.ts`, after `const config = getConfig();` (line 9), add:

```typescript
  if (!config.githubToken) {
    console.error("GitHub token required. Set 'githubToken' in config.json or GITHUB_TOKEN env var.");
    process.exit(1);
  }
```

And change line 10 from:

```typescript
  const octokit = createClient(config.githubToken!);
```

To:

```typescript
  const octokit = createClient(config.githubToken);
```

(Remove the `!` assertion — token is now guaranteed by the check above.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/fetch.ts
git commit -m "Make GitHub token optional in config for generate script"
```

---

### Task 3: Date helpers with TDD

Pure functions for time-period bucketing and relative date formatting. These are the core logic for grouping releases on the index page.

**Files:**
- Create: `src/render.ts`
- Create: `tests/render.test.ts`

- [ ] **Step 1: Write failing tests for getTimeBucket**

Create `tests/render.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getTimeBucket } from "../src/render.js";

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
```

- [ ] **Step 2: Write failing tests for getRelativeDate**

Append to `tests/render.test.ts`:

```typescript
import { getRelativeDate } from "../src/render.js";

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — module `../src/render.js` does not exist.

- [ ] **Step 4: Implement getTimeBucket and getRelativeDate**

Create `src/render.ts`:

```typescript
export type TimeBucket = "this-week" | "last-week" | "older";

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getTimeBucket(publishedAt: string, now?: Date): TimeBucket {
  const ref = now ?? new Date();
  const published = new Date(publishedAt);

  const thisWeekStart = getISOWeekStart(ref);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  if (published >= thisWeekStart) return "this-week";
  if (published >= lastWeekStart) return "last-week";
  return "older";
}

export function getRelativeDate(publishedAt: string, now?: Date): string {
  const ref = now ?? new Date();
  const published = new Date(publishedAt);
  const diffMs = ref.getTime() - published.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return published.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render.test.ts`
Expected: All 11 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "Add date helper functions with tests (getTimeBucket, getRelativeDate)"
```

---

### Task 4: Markdown helper with TDD

Thin wrapper around `marked` configured for GitHub-flavored markdown.

**Files:**
- Modify: `src/render.ts`
- Modify: `tests/render.test.ts`

- [ ] **Step 1: Write failing tests for renderMarkdown**

Append to `tests/render.test.ts`:

```typescript
import { renderMarkdown } from "../src/render.js";

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
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `npx vitest run tests/render.test.ts`
Expected: New tests FAIL — `renderMarkdown` is not exported from `../src/render.js`.

- [ ] **Step 3: Implement renderMarkdown**

Add to `src/render.ts`:

```typescript
import { marked } from "marked";

export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";
  return marked.parse(markdown) as string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render.test.ts`
Expected: All tests PASS (11 date + 4 markdown = 15 total).

- [ ] **Step 5: Commit**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "Add renderMarkdown helper with tests"
```

---

### Task 5: Template renderer with TDD

Factory function that creates an Eta-based renderer. The `renderPage` method renders a body template, then wraps it in the layout template.

**Files:**
- Modify: `src/render.ts`
- Modify: `tests/render.test.ts`

- [ ] **Step 1: Write failing tests for createRenderer**

Append to `tests/render.test.ts`:

```typescript
import { createRenderer } from "../src/render.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeAll, afterAll } from "vitest";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — `createRenderer` is not exported.

- [ ] **Step 3: Implement createRenderer**

Add to `src/render.ts`:

```typescript
import { Eta } from "eta";

export interface Renderer {
  renderPage(template: string, data: Record<string, unknown>): string;
}

export function createRenderer(templatesDir: string): Renderer {
  const eta = new Eta({ views: templatesDir, autoEscape: true });

  return {
    renderPage(template: string, data: Record<string, unknown>): string {
      const body = eta.render(`./${template}`, data);
      return eta.render("./layout", { ...data, body });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render.test.ts`
Expected: All tests PASS (15 + 2 = 17 total).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "Add Eta template renderer with tests"
```

---

### Task 6: Create Eta templates and stylesheet

The three `.eta` template files and the branded `style.css`. These are tested through the integration test in Task 7.

**Files:**
- Create: `templates/layout.eta`
- Create: `templates/index.eta`
- Create: `templates/repo.eta`
- Create: `templates/style.css`

- [ ] **Step 1: Create layout template**

Create `templates/layout.eta`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= it.siteTitle %><% if (it.pageTitle) { %> | <%= it.pageTitle %><% } %></title>
  <link rel="stylesheet" href="<%= it.basePath %>style.css">
</head>
<body>
  <nav class="repo-nav">
    <div class="nav-inner">
      <a href="<%= it.basePath || './' %>" class="nav-title"><%= it.siteTitle %></a>
      <ul class="nav-links">
        <% it.repos.forEach(function(repo) { %>
          <li>
            <a href="<%= it.basePath %><%= repo.name %>/"
               <% if (it.activeRepo === repo.name) { %>class="active"<% } %>>
              <%= repo.name %>
            </a>
          </li>
        <% }) %>
      </ul>
    </div>
  </nav>
  <main class="content">
    <%~ it.body %>
  </main>
  <footer class="site-footer">
    <p>Generated at <%= it.generatedAt %></p>
  </footer>
</body>
</html>
```

- [ ] **Step 2: Create index page template**

Create `templates/index.eta`:

```html
<h1 class="page-heading">Recent Releases</h1>
<% it.buckets.forEach(function(bucket) { %>
  <% if (bucket.releases.length > 0) { %>
    <section class="time-bucket">
      <h2 class="bucket-heading"><%= bucket.label %></h2>
      <% bucket.releases.forEach(function(release) { %>
        <article class="release-card">
          <div class="release-header">
            <a href="<%= release.repoName %>/" class="repo-badge"><%= release.repoName %></a>
            <span class="release-tag"><%= release.tagName %></span>
            <time class="release-date" datetime="<%= release.publishedAt %>"><%= release.relativeDate %></time>
          </div>
          <h3 class="release-name">
            <a href="<%= release.htmlUrl %>"><%= release.name || release.tagName %></a>
          </h3>
          <div class="release-meta">
            <img src="<%= release.author.avatarUrl %>&s=32" alt="" class="avatar" width="20" height="20">
            <a href="<%= release.author.htmlUrl %>" class="author-link"><%= release.author.login %></a>
          </div>
          <% if (release.bodyHtml) { %>
            <div class="release-body"><%~ release.bodyHtml %></div>
          <% } %>
        </article>
      <% }) %>
    </section>
  <% } %>
<% }) %>
```

- [ ] **Step 3: Create repo page template**

Create `templates/repo.eta`:

```html
<header class="repo-header">
  <h1 class="page-heading"><%= it.repo.name %></h1>
  <% if (it.repo.description) { %>
    <p class="repo-description"><%= it.repo.description %></p>
  <% } %>
  <a href="<%= it.repo.url %>" class="github-link">View on GitHub &rarr;</a>
</header>
<div class="releases-list">
  <% it.releases.forEach(function(release) { %>
    <article class="release-card">
      <div class="release-header">
        <span class="release-tag"><%= release.tagName %></span>
        <time class="release-date" datetime="<%= release.publishedAt %>"><%= release.relativeDate %></time>
      </div>
      <h3 class="release-name">
        <a href="<%= release.htmlUrl %>"><%= release.name || release.tagName %></a>
      </h3>
      <div class="release-meta">
        <img src="<%= release.author.avatarUrl %>&s=32" alt="" class="avatar" width="20" height="20">
        <a href="<%= release.author.htmlUrl %>" class="author-link"><%= release.author.login %></a>
      </div>
      <% if (release.bodyHtml) { %>
        <div class="release-body"><%~ release.bodyHtml %></div>
      <% } %>
    </article>
  <% }) %>
</div>
```

- [ ] **Step 4: Create branded stylesheet**

Create `templates/style.css`:

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f8f9fb;
  --color-text: #1a1a2e;
  --color-text-secondary: #6b7280;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-accent-light: #dbeafe;
  --color-border: #e5e7eb;
  --color-code-bg: #f3f4f6;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  --max-width: 960px;
  --radius: 8px;
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Navigation */
.repo-nav {
  background: var(--color-text);
  color: #fff;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 2rem;
  height: 56px;
}

.nav-title {
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.125rem;
  white-space: nowrap;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-links::-webkit-scrollbar {
  display: none;
}

.nav-links a {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius);
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.nav-links a:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.nav-links a.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

/* Content */
.content {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.page-heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

/* Time buckets */
.time-bucket {
  margin-bottom: 2.5rem;
}

.bucket-heading {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-accent);
  margin-bottom: 1rem;
}

/* Release cards */
.release-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-bottom: 0.75rem;
}

.release-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.repo-badge {
  display: inline-block;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  text-decoration: none;
  transition: background 0.15s;
}

.repo-badge:hover {
  background: var(--color-accent);
  color: #fff;
}

.release-tag {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: var(--color-code-bg);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.release-date {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.release-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.release-name a {
  color: var(--color-text);
  text-decoration: none;
}

.release-name a:hover {
  color: var(--color-accent);
}

.release-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.avatar {
  border-radius: 50%;
}

.author-link {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-decoration: none;
}

.author-link:hover {
  color: var(--color-accent);
}

/* Release body (rendered markdown) */
.release-body {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--color-text);
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
}

.release-body h1,
.release-body h2,
.release-body h3 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.release-body h1 { font-size: 1.25rem; }
.release-body h2 { font-size: 1.125rem; }
.release-body h3 { font-size: 1rem; }

.release-body p {
  margin-bottom: 0.75rem;
}

.release-body ul,
.release-body ol {
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
}

.release-body li {
  margin-bottom: 0.25rem;
}

.release-body code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--color-code-bg);
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
}

.release-body pre {
  background: var(--color-code-bg);
  border-radius: var(--radius);
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 0.75rem;
}

.release-body pre code {
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.release-body a {
  color: var(--color-accent);
  text-decoration: none;
}

.release-body a:hover {
  text-decoration: underline;
}

.release-body blockquote {
  border-left: 3px solid var(--color-accent);
  padding-left: 1rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

.release-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}

.release-body th,
.release-body td {
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.release-body th {
  background: var(--color-code-bg);
  font-weight: 600;
}

/* Repo page header */
.repo-header {
  margin-bottom: 2rem;
}

.repo-description {
  font-size: 1.0625rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.github-link {
  font-size: 0.875rem;
  color: var(--color-accent);
  text-decoration: none;
}

.github-link:hover {
  text-decoration: underline;
}

/* Footer */
.site-footer {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

/* Mobile */
@media (max-width: 640px) {
  .nav-inner {
    flex-direction: column;
    height: auto;
    padding: 0.75rem 0;
    gap: 0.5rem;
  }

  .content {
    padding: 1.5rem 1rem;
  }

  .release-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }

  .release-date {
    margin-left: 0;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add templates/
git commit -m "Add Eta templates and branded stylesheet"
```

---

### Task 7: Generate entry point with integration tests

The main `generate.ts` script reads JSON, builds template data, renders pages, and writes output. Also adds template data interfaces to `types.ts`.

**Files:**
- Modify: `src/types.ts`
- Create: `src/generate.ts` (replaces placeholder)
- Create: `tests/generate.test.ts`

- [ ] **Step 1: Add template data interfaces to types.ts**

Append to `src/types.ts`:

```typescript
export interface ReleaseCardData {
  repoName: string;
  tagName: string;
  name: string;
  publishedAt: string;
  relativeDate: string;
  bodyHtml: string;
  htmlUrl: string;
  author: {
    login: string;
    avatarUrl: string;
    htmlUrl: string;
  };
}

export interface TimeBucketData {
  label: string;
  releases: ReleaseCardData[];
}
```

- [ ] **Step 2: Write failing integration test**

Create `tests/generate.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateSite } from "../src/generate.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("generateSite", () => {
  let tmpDir: string;
  let dataPath: string;
  let outputDir: string;
  const templatesDir = join(process.cwd(), "templates");

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "generate-test-"));
    const dataDir = join(tmpDir, "data");
    mkdirSync(dataDir);
    outputDir = join(tmpDir, "site");

    const fixture = {
      org: "test-org",
      generatedAt: "2026-06-04T12:00:00Z",
      repos: [
        {
          name: "api-service",
          url: "https://github.com/test-org/api-service",
          description: "The main API",
          releases: [
            {
              id: 1,
              repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.1.0",
              name: "Release 2.1.0",
              body: "## Changes\n- Added **new endpoint**\n- Fixed bug",
              htmlUrl:
                "https://github.com/test-org/api-service/releases/tag/v2.1.0",
              publishedAt: "2026-06-03T10:00:00Z",
              isDraft: false,
              isPrerelease: false,
              author: {
                login: "dev1",
                avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
                htmlUrl: "https://github.com/dev1",
              },
            },
            {
              id: 2,
              repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.0.0",
              name: "Release 2.0.0",
              body: "Major release",
              htmlUrl:
                "https://github.com/test-org/api-service/releases/tag/v2.0.0",
              publishedAt: "2026-05-01T10:00:00Z",
              isDraft: false,
              isPrerelease: false,
              author: {
                login: "dev2",
                avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
                htmlUrl: "https://github.com/dev2",
              },
            },
          ],
        },
        {
          name: "web-app",
          url: "https://github.com/test-org/web-app",
          description: "Frontend application",
          releases: [
            {
              id: 3,
              repoName: "web-app",
              repoUrl: "https://github.com/test-org/web-app",
              tagName: "v1.5.0",
              name: "UI Refresh",
              body: "New look",
              htmlUrl:
                "https://github.com/test-org/web-app/releases/tag/v1.5.0",
              publishedAt: "2026-06-02T14:00:00Z",
              isDraft: false,
              isPrerelease: false,
              author: {
                login: "dev1",
                avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
                htmlUrl: "https://github.com/dev1",
              },
            },
          ],
        },
      ],
    };

    dataPath = join(dataDir, "releases.json");
    writeFileSync(dataPath, JSON.stringify(fixture));

    await generateSite({
      dataPath,
      outputDir,
      templatesDir,
      siteTitle: "Test Changelog",
      siteUrl: "",
    });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("generates index.html", () => {
    const indexPath = join(outputDir, "index.html");
    expect(existsSync(indexPath)).toBe(true);
    const html = readFileSync(indexPath, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Changelog");
    expect(html).toContain("api-service");
    expect(html).toContain("web-app");
  });

  it("renders markdown in release bodies on index page", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("<strong>new endpoint</strong>");
  });

  it("generates repo pages", () => {
    expect(existsSync(join(outputDir, "api-service", "index.html"))).toBe(true);
    expect(existsSync(join(outputDir, "web-app", "index.html"))).toBe(true);
  });

  it("repo page contains release data", () => {
    const html = readFileSync(
      join(outputDir, "api-service", "index.html"),
      "utf-8",
    );
    expect(html).toContain("Release 2.1.0");
    expect(html).toContain("v2.1.0");
    expect(html).toContain("The main API");
  });

  it("repo page links back to index via basePath", () => {
    const html = readFileSync(
      join(outputDir, "api-service", "index.html"),
      "utf-8",
    );
    expect(html).toContain('href="../"');
  });

  it("copies style.css to output", () => {
    expect(existsSync(join(outputDir, "style.css"))).toBe(true);
    const css = readFileSync(join(outputDir, "style.css"), "utf-8");
    expect(css).toContain("--color-accent");
  });

  it("index page has time bucket headings", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("Older");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — `generateSite` is not exported from `../src/generate.js`.

- [ ] **Step 4: Implement generateSite**

Replace `src/generate.ts` with:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import {
  createRenderer,
  getTimeBucket,
  getRelativeDate,
  renderMarkdown,
  type TimeBucket,
} from "./render.js";
import type { SiteData, Release, ReleaseCardData, TimeBucketData } from "./types.js";

const BUCKET_ORDER: TimeBucket[] = ["this-week", "last-week", "older"];
const BUCKET_LABELS: Record<TimeBucket, string> = {
  "this-week": "This Week",
  "last-week": "Last Week",
  older: "Older",
};

function toCardData(release: Release, now: Date): ReleaseCardData {
  return {
    repoName: release.repoName,
    tagName: release.tagName,
    name: release.name,
    publishedAt: release.publishedAt,
    relativeDate: getRelativeDate(release.publishedAt, now),
    bodyHtml: renderMarkdown(release.body),
    htmlUrl: release.htmlUrl,
    author: release.author,
  };
}

export interface GenerateOptions {
  dataPath: string;
  outputDir: string;
  templatesDir: string;
  siteTitle: string;
  siteUrl: string;
}

export async function generateSite(options: GenerateOptions): Promise<void> {
  const { dataPath, outputDir, templatesDir, siteTitle, siteUrl } = options;

  if (!existsSync(dataPath)) {
    throw new Error(
      `${dataPath} not found. Run "npm run fetch" first to generate release data.`,
    );
  }

  const raw = readFileSync(dataPath, "utf-8");
  const siteData: SiteData = JSON.parse(raw);
  const now = new Date();
  const renderer = createRenderer(templatesDir);

  const repoList = siteData.repos.map((r) => ({ name: r.name }));

  // --- Index page ---
  const allReleases: Release[] = siteData.repos
    .flatMap((repo) => repo.releases)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  const bucketMap = new Map<TimeBucket, ReleaseCardData[]>();
  for (const bucket of BUCKET_ORDER) {
    bucketMap.set(bucket, []);
  }
  for (const release of allReleases) {
    const bucket = getTimeBucket(release.publishedAt, now);
    bucketMap.get(bucket)!.push(toCardData(release, now));
  }

  const buckets: TimeBucketData[] = BUCKET_ORDER.filter(
    (b) => bucketMap.get(b)!.length > 0,
  ).map((b) => ({
    label: BUCKET_LABELS[b],
    releases: bucketMap.get(b)!,
  }));

  mkdirSync(outputDir, { recursive: true });

  const indexHtml = renderer.renderPage("index", {
    siteTitle,
    pageTitle: "",
    basePath: "",
    repos: repoList,
    generatedAt: siteData.generatedAt,
    buckets,
  });
  writeFileSync(join(outputDir, "index.html"), indexHtml);

  // --- Repo pages ---
  for (const repo of siteData.repos) {
    const repoDir = join(outputDir, repo.name);
    mkdirSync(repoDir, { recursive: true });

    const releases = repo.releases.map((r) => toCardData(r, now));

    const repoHtml = renderer.renderPage("repo", {
      siteTitle,
      pageTitle: repo.name,
      basePath: "../",
      repos: repoList,
      generatedAt: siteData.generatedAt,
      activeRepo: repo.name,
      repo: { name: repo.name, description: repo.description, url: repo.url },
      releases,
    });
    writeFileSync(join(repoDir, "index.html"), repoHtml);
  }

  // --- Copy stylesheet ---
  const cssSource = join(templatesDir, "style.css");
  copyFileSync(cssSource, join(outputDir, "style.css"));

  console.log(
    `Generated site: index + ${siteData.repos.length} repo pages → ${outputDir}/`,
  );
}

async function main(): Promise<void> {
  const config = getConfig();
  const projectRoot = process.cwd();

  await generateSite({
    dataPath: resolve(projectRoot, "data", "releases.json"),
    outputDir: resolve(projectRoot, config.outputDir),
    templatesDir: resolve(projectRoot, "templates"),
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
  });
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles with no errors.

- [ ] **Step 6: Run integration tests**

Run: `npx vitest run tests/generate.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: All tests PASS (render: 17, generate: 7 = 24 total).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/generate.ts tests/generate.test.ts
git commit -m "Add site generation entry point with integration tests"
```

---

### Task 8: Wire up npm scripts and end-to-end verification

Update `package.json` scripts and verify the full pipeline works.

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update package.json scripts**

In `package.json`, replace the `"scripts"` section with:

```json
"scripts": {
  "build": "tsc",
  "fetch": "node dist/fetch.js",
  "generate": "node dist/generate.js",
  "build:site": "npm run build && npm run fetch && npm run generate",
  "test": "vitest run"
}
```

- [ ] **Step 2: Add output directory to .gitignore**

Append to `.gitignore`:

```
site/
```

- [ ] **Step 3: Verify build + generate pipeline**

Run: `npm run build`
Expected: Compiles with no errors.

Run: `npm run generate` (requires `data/releases.json` from a prior `npm run fetch`)
Expected: If releases.json exists, generates the site. If not, prints the helpful error message.

- [ ] **Step 4: Run full test suite one final time**

Run: `npm test`
Expected: All 24 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "Wire up generate script and build:site convenience command"
```
