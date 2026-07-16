# Single-Page Daily Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the daily report from a multi-page static site into a single self-contained HTML file with inline repo detail views, hash-based routing, and sidebar navigation.

**Architecture:** Add a new `report.eta` template that's a complete standalone HTML document (no layout wrapper) with inlined CSS and a `<script>` block for hash routing. Add `generateReport()` to `generate.ts` that produces `site/report.html`. Add `src/report.ts` as a thin CLI entry point. Update Makefile so `make report` generates only the single-page file. Existing `generateSite()` and `make site` remain untouched.

**Tech Stack:** TypeScript, Eta templates, existing CSS from `style.css` (inlined at build time)

## Global Constraints

- Do not modify `generateSite()` or any existing template (`layout.eta`, `index.eta`, `repo.eta`, `feed.eta`)
- `make site` must continue to produce the same multi-page output for GitHub Pages
- The single HTML file must work when opened via `file://` protocol (no external file references)
- Use `hashchange` event listener (not `popstate`) for routing — `file://` supports fragment identifiers natively

---

### Task 1: Add `generateReport()` function with tests

**Files:**
- Modify: `src/render.ts:60-77` (add `renderStandalone` method to Renderer)
- Create: `templates/report.eta`
- Modify: `src/generate.ts` (add `generateReport()` export)
- Modify: `tests/generate.test.ts` (add `generateReport` test suite)

**Interfaces:**
- Consumes: `GenerateOptions` from `src/generate.ts:34-40`, `createRenderer` from `src/render.ts:65`, `toCardData` (internal to `generate.ts:21`), all types from `src/types.ts`
- Produces: `generateReport(options: GenerateOptions): Promise<void>` — generates `site/report.html`; `Renderer.renderStandalone(template: string, data: Record<string, unknown>): string` — renders a template without layout wrapping

- [ ] **Step 1: Write failing tests for `generateReport`**

Add a new `describe` block to the existing test file:

```typescript
// Append to tests/generate.test.ts — add generateReport to the import
import { generateSite, generateReport } from "../src/generate.js";

describe("generateReport", () => {
  let tmpDir: string;
  let dataPath: string;
  let outputDir: string;
  const templatesDir = join(process.cwd(), "templates");

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "report-test-"));
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

    await generateReport({
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

  it("generates report.html", () => {
    const reportPath = join(outputDir, "report.html");
    expect(existsSync(reportPath)).toBe(true);
    const html = readFileSync(reportPath, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Changelog");
  });

  it("inlines CSS (no external stylesheet link)", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain("<style>");
    expect(html).toContain("--color-accent");
    expect(html).not.toContain('<link rel="stylesheet"');
  });

  it("sidebar uses hash links for repos", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain('href="#api-service"');
    expect(html).toContain('href="#web-app"');
  });

  it("contains the all-repos time-bucketed view", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain('id="view-all"');
    expect(html).toContain("Recent Releases");
  });

  it("contains inline repo sections", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain('id="repo-api-service"');
    expect(html).toContain('id="repo-web-app"');
    expect(html).toContain("Release 2.1.0");
    expect(html).toContain("UI Refresh");
    expect(html).toContain("The main API");
  });

  it("repo sections are hidden by default", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    const repoSectionPattern = /id="repo-[^"]+"/g;
    const matches = html.match(repoSectionPattern);
    expect(matches).not.toBeNull();
    for (const match of matches!) {
      const id = match.replace('id="', '').replace('"', '');
      const sectionRegex = new RegExp(
        `<section[^>]*id="${id}"[^>]*style="display:\\s*none"`,
      );
      expect(html).toMatch(sectionRegex);
    }
  });

  it("includes hash routing script", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain("<script>");
    expect(html).toContain("hashchange");
  });

  it("has no external file references (fully self-contained)", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).not.toContain('<link rel="stylesheet" href=');
    expect(html).not.toContain('<script src=');
  });

  it("does not generate repo subdirectories", () => {
    expect(existsSync(join(outputDir, "api-service"))).toBe(false);
    expect(existsSync(join(outputDir, "web-app"))).toBe(false);
  });

  it("renders markdown in release bodies", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain("<strong>new endpoint</strong>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — `generateReport` is not exported from `../src/generate.js`

- [ ] **Step 3: Add `renderStandalone` to the Renderer interface and implementation**

In `src/render.ts`, update the `Renderer` interface and `createRenderer`:

```typescript
export interface Renderer {
  renderPage(template: string, data: Record<string, unknown>): string;
  renderStandalone(template: string, data: Record<string, unknown>): string;
  renderFeed(feedData: AtomFeed): string;
}

export function createRenderer(templatesDir: string): Renderer {
  const eta = new Eta({ views: templatesDir, autoEscape: true });

  return {
    renderPage(template: string, data: Record<string, unknown>): string {
      const body = eta.render(`./${template}`, data) as string;
      return eta.render("./layout", { ...data, body }) as string;
    },
    renderStandalone(template: string, data: Record<string, unknown>): string {
      return eta.render(`./${template}`, data) as string;
    },
    renderFeed(feedData: AtomFeed): string {
      return eta.render("./feed", feedData) as string;
    },
  };
}
```

- [ ] **Step 4: Create `templates/report.eta`**

```eta
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= it.siteTitle %> | Daily Report</title>
  <style><%~ it.css %></style>
</head>
<body>
  <div class="app-layout">
    <nav class="sidebar">
      <a href="#" class="nav-title"><%= it.siteTitle %></a>
      <ul class="nav-links">
        <% it.repos.forEach(function(repo) { %>
          <li>
            <a href="#<%= repo.name %>" data-repo="<%= repo.name %>">
              <%= repo.name %>
            </a>
          </li>
        <% }) %>
      </ul>
    </nav>
    <div class="main-area">
      <main class="content">
        <section id="view-all" class="report-section">
          <h1 class="page-heading">Recent Releases</h1>
          <% it.buckets.forEach(function(bucket) { %>
            <% if (bucket.releases.length > 0) { %>
              <section class="time-bucket">
                <h2 class="bucket-heading"><%= bucket.label %></h2>
                <% bucket.releases.forEach(function(release) { %>
                  <article class="release-card">
                    <div class="release-header">
                      <a href="#<%= release.repoName %>" class="repo-badge"><%= release.repoName %></a>
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
        </section>
        <% it.repoSections.forEach(function(repoData) { %>
          <section id="repo-<%= repoData.repo.name %>" class="report-section" style="display: none">
            <header class="repo-header">
              <h1 class="page-heading"><%= repoData.repo.name %></h1>
              <% if (repoData.repo.description) { %>
                <p class="repo-description"><%= repoData.repo.description %></p>
              <% } %>
              <a href="<%= repoData.repo.url %>" class="github-link">View on GitHub &rarr;</a>
            </header>
            <div class="releases-list">
              <% repoData.releases.forEach(function(release) { %>
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
          </section>
        <% }) %>
      </main>
      <footer class="site-footer">
        <p>Generated at <%= it.generatedAt %></p>
      </footer>
    </div>
  </div>
  <script>
    (function() {
      var sections = document.querySelectorAll('.report-section');
      var navLinks = document.querySelectorAll('.nav-links a');

      function showSection(hash) {
        var target = hash ? hash.replace('#', '') : '';

        sections.forEach(function(s) { s.style.display = 'none'; });
        navLinks.forEach(function(a) { a.classList.remove('active'); });

        if (target) {
          var repoSection = document.getElementById('repo-' + target);
          if (repoSection) {
            repoSection.style.display = '';
            navLinks.forEach(function(a) {
              if (a.getAttribute('data-repo') === target) a.classList.add('active');
            });
            return;
          }
        }
        document.getElementById('view-all').style.display = '';
      }

      window.addEventListener('hashchange', function() {
        showSection(window.location.hash);
      });

      showSection(window.location.hash);
    })();
  </script>
</body>
</html>
```

- [ ] **Step 5: Add `generateReport()` to `src/generate.ts`**

Add this function after the existing `generateSite()` function (before `main()`). Also export `toCardData` is not needed — it's already accessible within the module. Add the function:

```typescript
export async function generateReport(options: GenerateOptions): Promise<void> {
  const { dataPath, outputDir, templatesDir, siteTitle } = options;

  if (!existsSync(dataPath)) {
    throw new Error(
      `${dataPath} not found. Run "npm run fetch" first to generate release data.`,
    );
  }

  const raw = readFileSync(dataPath, "utf-8");
  const siteData: SiteData = JSON.parse(raw);
  const now = new Date();
  const renderer = createRenderer(templatesDir);

  const repoList = siteData.repos
    .map((r) => ({ name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const repoSections = siteData.repos
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((repo) => ({
      repo: { name: repo.name, description: repo.description, url: repo.url },
      releases: repo.releases.map((r) => toCardData(r, now)),
    }));

  const css = readFileSync(join(templatesDir, "style.css"), "utf-8");

  mkdirSync(outputDir, { recursive: true });

  const reportHtml = renderer.renderStandalone("report", {
    siteTitle,
    generatedAt: siteData.generatedAt,
    css,
    repos: repoList,
    buckets,
    repoSections,
  });
  writeFileSync(join(outputDir, "report.html"), reportHtml);

  console.log(`Generated report → ${join(outputDir, "report.html")}`);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/generate.test.ts`
Expected: ALL PASS — both existing `generateSite` tests and new `generateReport` tests

- [ ] **Step 7: Commit**

```bash
git add src/render.ts src/generate.ts templates/report.eta tests/generate.test.ts
git commit -m "feat: add single-page report generation with inline repo views"
```

---

### Task 2: Add report entry point, update Makefile, verify no regression

**Files:**
- Create: `src/report.ts`
- Modify: `Makefile:1-29`

**Interfaces:**
- Consumes: `generateReport` from `src/generate.ts`, `getConfig` from `src/config.ts`
- Produces: `dist/report.js` CLI entry point (invoked by `make report-generate`); updated Makefile targets `report-generate` and `report`

- [ ] **Step 1: Create `src/report.ts`**

```typescript
import { resolve } from "node:path";
import { getConfig } from "./config.js";
import { generateReport } from "./generate.js";

async function main(): Promise<void> {
  const config = getConfig();
  const projectRoot = process.cwd();

  await generateReport({
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

- [ ] **Step 2: Update Makefile**

Replace the `report` target and add `report-generate`:

```makefile
-include .env
export

.PHONY: clean build fetch generate site serve test local report report-generate

local: clean site serve

clean:
	rm -rf dist site

build:
	npx tsc

fetch: build
	node dist/fetch.js

generate: build
	node dist/generate.js

site: build fetch generate

serve:
	python3 -m http.server $(or $(PORT),8000) -d site

test:
	npx vitest run

report-generate: build
	node dist/report.js

report: build fetch report-generate
	open site/report.html
```

- [ ] **Step 3: Run full test suite to verify no regression**

Run: `npx vitest run`
Expected: ALL PASS — existing tests unchanged, new tests pass

- [ ] **Step 4: Verify TypeScript compiles cleanly**

Run: `npx tsc`
Expected: No errors. `dist/report.js` should be generated alongside existing files.

- [ ] **Step 5: Commit**

```bash
git add src/report.ts Makefile
git commit -m "feat: add report entry point and update Makefile targets"
```
