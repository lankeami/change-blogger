import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateSite, generateReport, generateMarkdownReport, extractDevelopers } from "../src/generate.js";
import { createUserCache } from "../src/users.js";
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
              htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.1.0",
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
              htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.0.0",
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
              htmlUrl: "https://github.com/test-org/web-app/releases/tag/v1.5.0",
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
    const html = readFileSync(join(outputDir, "api-service", "index.html"), "utf-8");
    expect(html).toContain("Release 2.1.0");
    expect(html).toContain("v2.1.0");
    expect(html).toContain("The main API");
  });

  it("repo page links back to index via basePath", () => {
    const html = readFileSync(join(outputDir, "api-service", "index.html"), "utf-8");
    expect(html).toContain('href="../');
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

  it("generates global feed.xml", () => {
    const feedPath = join(outputDir, "feed.xml");
    expect(existsSync(feedPath)).toBe(true);
    const xml = readFileSync(feedPath, "utf-8");
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain("Test Changelog");
  });

  it("global feed contains entries from all repos", () => {
    const xml = readFileSync(join(outputDir, "feed.xml"), "utf-8");
    expect(xml).toContain("api-service v2.1.0");
    expect(xml).toContain("web-app v1.5.0");
  });

  it("generates per-repo feed.xml files", () => {
    expect(existsSync(join(outputDir, "api-service", "feed.xml"))).toBe(true);
    expect(existsSync(join(outputDir, "web-app", "feed.xml"))).toBe(true);
  });

  it("per-repo feed is scoped to that repo", () => {
    const xml = readFileSync(join(outputDir, "api-service", "feed.xml"), "utf-8");
    expect(xml).toContain("<title><![CDATA[api-service]]></title>");
    expect(xml).toContain("api-service v2.1.0");
    expect(xml).toContain("api-service v2.0.0");
  });
});

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

// ── Issue #20: user cache ───────────────────────────────────────────────────

describe("user cache", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "user-cache-test-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("fetches an uncached login once and persists it with the display name", async () => {
    const cachePath = join(tmpDir, "users-a.json");
    const fetcher = vi.fn(async (_login: string) => ({
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
      htmlUrl: "https://github.com/octocat",
    }));
    const cache = createUserCache({ cachePath, fetcher });

    const user = await cache.resolve("octocat");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(user).toMatchObject({ login: "octocat", name: "The Octocat" });

    expect(existsSync(cachePath)).toBe(true);
    const stored = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(stored.octocat).toMatchObject({
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
      htmlUrl: "https://github.com/octocat",
    });
  });

  it("makes zero fetch calls for a cached login (fresh instance from disk)", async () => {
    const cachePath = join(tmpDir, "users-b.json");
    const firstFetcher = vi.fn(async (_login: string) => ({
      name: "Dev One",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      htmlUrl: "https://github.com/dev1",
    }));
    await createUserCache({ cachePath, fetcher: firstFetcher }).resolve("dev1");

    const secondFetcher = vi.fn(async (_login: string) => ({
      name: "SHOULD NOT BE CALLED",
      avatarUrl: "",
      htmlUrl: "",
    }));
    const cache = createUserCache({ cachePath, fetcher: secondFetcher });
    const user = await cache.resolve("dev1");

    expect(secondFetcher).toHaveBeenCalledTimes(0);
    expect(user).toMatchObject({ login: "dev1", name: "Dev One" });
  });

  it("caches name: null for users without a public display name", async () => {
    const cachePath = join(tmpDir, "users-c.json");
    const fetcher = vi.fn(async (_login: string) => ({
      name: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/9?v=4",
      htmlUrl: "https://github.com/noname",
    }));
    const cache = createUserCache({ cachePath, fetcher });
    const user = await cache.resolve("noname");

    expect(user).toMatchObject({ login: "noname", name: null });
    const stored = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(stored.noname.name).toBeNull();
  });

  it("negative-caches unknown users so they are not re-requested", async () => {
    const cachePath = join(tmpDir, "users-d.json");
    const notFoundFetcher = vi.fn(async (_login: string) => null);
    const first = createUserCache({ cachePath, fetcher: notFoundFetcher });
    await first.resolve("ghost-user");
    expect(notFoundFetcher).toHaveBeenCalledTimes(1);

    const secondFetcher = vi.fn(async (_login: string) => null);
    const second = createUserCache({ cachePath, fetcher: secondFetcher });
    const user = await second.resolve("ghost-user");

    expect(secondFetcher).toHaveBeenCalledTimes(0);
    expect(user).toMatchObject({ login: "ghost-user", missing: true });
  });

  it("seeds login/avatar/profile without marking the name as fetched", async () => {
    const cachePath = join(tmpDir, "users-e.json");
    const fetcher = vi.fn(async (_login: string) => ({
      name: "Dev Two",
      avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
      htmlUrl: "https://github.com/dev2",
    }));
    const cache = createUserCache({ cachePath, fetcher });
    cache.seed({
      login: "dev2",
      avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
      htmlUrl: "https://github.com/dev2",
    });

    // seeded entry still needs one fetch for the display name
    const user = await cache.resolve("dev2");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(user).toMatchObject({ login: "dev2", name: "Dev Two" });

    // but afterwards it is fully cached
    await cache.resolve("dev2");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

// ── Issue #20: report user pills + cache wiring ─────────────────────────────

describe("generateReport user pills", () => {
  let tmpDir: string;
  let dataPath: string;
  let usersPath: string;
  let outputDir: string;
  const templatesDir = join(process.cwd(), "templates");

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
            body: "Thanks @dev2 for the review. See `@not-a-user` in code.",
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
        ],
      },
    ],
  };

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "report-pills-test-"));
    const dataDir = join(tmpDir, "data");
    mkdirSync(dataDir);
    outputDir = join(tmpDir, "site");
    dataPath = join(dataDir, "releases.json");
    usersPath = join(dataDir, "users.json");
    writeFileSync(dataPath, JSON.stringify(fixture));

    const fetcher = async (login: string) => ({
      name: login === "dev1" ? "Dev One" : login === "dev2" ? "Dev Two" : null,
      avatarUrl: `https://avatars.githubusercontent.com/u/${login}?v=4`,
      htmlUrl: `https://github.com/${login}`,
    });

    await generateReport({
      dataPath,
      outputDir,
      templatesDir,
      siteTitle: "Test Changelog",
      siteUrl: "",
      usersPath,
      userFetcher: fetcher,
    });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("creates users.json after a report build", () => {
    expect(existsSync(usersPath)).toBe(true);
    const stored = JSON.parse(readFileSync(usersPath, "utf-8"));
    expect(stored.dev1).toMatchObject({ login: "dev1", name: "Dev One" });
    expect(stored.dev2).toMatchObject({ login: "dev2", name: "Dev Two" });
  });

  it("renders the release author as a user pill with data attributes", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toMatch(
      /<a [^>]*class="user-pill"[^>]*data-login="dev1"[^>]*data-name="Dev One"/
    );
  });

  it("renders @mentions in release bodies as user pills", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toMatch(/<a [^>]*class="user-pill"[^>]*data-login="dev2"/);
    expect(html).toContain("Dev Two");
  });

  it("leaves mentions inside code spans untouched", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).toContain("<code>@not-a-user</code>");
    expect(html).not.toMatch(/data-login="not-a-user"/);
  });

  it("uses the shared pill for authors (no duplicated author-link markup)", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    expect(html).not.toContain('class="author-link"');
  });

  it("every external link in the report opens in a new tab", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    const external = html.match(/<a [^>]*href="https?:\/\/[^>]*>/g) ?? [];
    expect(external.length).toBeGreaterThan(0);
    for (const anchor of external) {
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toContain('rel="noopener noreferrer"');
    }
  });

  it("internal hash links do not get new-tab attributes", () => {
    const html = readFileSync(join(outputDir, "report.html"), "utf-8");
    const internal = html.match(/<a [^>]*href="#[^>]*>/g) ?? [];
    expect(internal.length).toBeGreaterThan(0);
    for (const anchor of internal) {
      expect(anchor).not.toContain('target="_blank"');
    }
  });

  it("a second build makes zero user requests for cached logins", async () => {
    const fetchSpy = vi.fn(async (_login: string) => ({
      name: "SHOULD NOT BE CALLED",
      avatarUrl: "",
      htmlUrl: "",
    }));
    await generateReport({
      dataPath,
      outputDir,
      templatesDir,
      siteTitle: "Test Changelog",
      siteUrl: "",
      usersPath,
      userFetcher: fetchSpy,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

describe("generateMarkdownReport", () => {
  let tmpDir: string;
  let dataPath: string;
  let outputDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "md-report-test-"));
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
              body: "## Changes\n- Added new endpoint\n- Fixed bug",
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

    await generateMarkdownReport({
      dataPath,
      outputDir,
      siteTitle: "Test Changelog",
    });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("generates releases.md file", () => {
    const mdPath = join(outputDir, "releases.md");
    expect(existsSync(mdPath)).toBe(true);
  });

  it("contains the site title as heading", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    expect(md).toContain("# Test Changelog");
  });

  it("contains time bucket headings", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    // All fixture dates are old relative to "now", so they should be in "Older"
    expect(md).toContain("## Older");
  });

  it("contains markdown table headers with correct columns", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    expect(md).toContain("| Repo | Tag | Release Name | Date | Author |");
    expect(md).toContain("| --- | --- | --- | --- | --- |");
  });

  it("contains release data in table rows", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    expect(md).toContain("api-service");
    expect(md).toContain("v2.1.0");
    expect(md).toContain("Release 2.1.0");
    expect(md).toContain("dev1");
    expect(md).toContain("web-app");
    expect(md).toContain("v1.5.0");
    expect(md).toContain("UI Refresh");
  });

  it("contains details blocks with release body content", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    expect(md).toContain("<details>");
    expect(md).toContain("</details>");
    expect(md).toContain("Added new endpoint");
    expect(md).toContain("Major release");
  });

  it("includes summary text in details blocks", () => {
    const md = readFileSync(join(outputDir, "releases.md"), "utf-8");
    expect(md).toContain("<summary>");
    expect(md).toContain("api-service v2.1.0");
  });

  it("throws when data file is missing", async () => {
    await expect(
      generateMarkdownReport({
        dataPath: "/nonexistent/releases.json",
        outputDir,
        siteTitle: "Test",
      })
    ).rejects.toThrow("not found");
  });
});

// ── Issue #24: extractDevelopers ───────────────────────────────────────────

describe("extractDevelopers", () => {
  it("returns unique developers sorted alphabetically by login", () => {
    const releases = [
      {
        id: 1, repoName: "repo-a", repoUrl: "", tagName: "v1.0.0",
        name: "R1", body: "", htmlUrl: "", publishedAt: "2026-06-01T00:00:00Z",
        isDraft: false, isPrerelease: false,
        author: { login: "zara", avatarUrl: "https://avatars.githubusercontent.com/u/3?v=4", htmlUrl: "https://github.com/zara" },
      },
      {
        id: 2, repoName: "repo-b", repoUrl: "", tagName: "v2.0.0",
        name: "R2", body: "", htmlUrl: "", publishedAt: "2026-06-02T00:00:00Z",
        isDraft: false, isPrerelease: false,
        author: { login: "alice", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/alice" },
      },
      {
        id: 3, repoName: "repo-a", repoUrl: "", tagName: "v1.1.0",
        name: "R3", body: "", htmlUrl: "", publishedAt: "2026-06-03T00:00:00Z",
        isDraft: false, isPrerelease: false,
        author: { login: "zara", avatarUrl: "https://avatars.githubusercontent.com/u/3?v=4", htmlUrl: "https://github.com/zara" },
      },
    ];

    const devs = extractDevelopers(releases);
    expect(devs).toHaveLength(2);
    expect(devs[0].login).toBe("alice");
    expect(devs[1].login).toBe("zara");
  });

  it("includes avatarUrl and htmlUrl from the release author", () => {
    const releases = [
      {
        id: 1, repoName: "r", repoUrl: "", tagName: "v1.0.0",
        name: "R1", body: "", htmlUrl: "", publishedAt: "2026-06-01T00:00:00Z",
        isDraft: false, isPrerelease: false,
        author: { login: "dev1", avatarUrl: "https://avatars/1", htmlUrl: "https://github.com/dev1" },
      },
    ];
    const devs = extractDevelopers(releases);
    expect(devs).toHaveLength(1);
    expect(devs[0]).toMatchObject({
      login: "dev1",
      avatarUrl: "https://avatars/1",
      htmlUrl: "https://github.com/dev1",
    });
  });

  it("returns an empty array when there are no releases", () => {
    expect(extractDevelopers([])).toEqual([]);
  });
});

// ── Issue #24: right sidebar in generated site ────────────────────────────

describe("generateSite right sidebar", () => {
  let tmpDir: string;
  let dataPath: string;
  let outputDir: string;
  const templatesDir = join(process.cwd(), "templates");

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "sidebar-right-test-"));
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
              id: 1, repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.1.0", name: "Release 2.1.0",
              body: "Changes", htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.1.0",
              publishedAt: "2026-06-03T10:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev1", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/dev1" },
            },
            {
              id: 2, repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.0.0", name: "Release 2.0.0",
              body: "Major release", htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.0.0",
              publishedAt: "2026-05-01T10:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev2", avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4", htmlUrl: "https://github.com/dev2" },
            },
          ],
        },
        {
          name: "web-app",
          url: "https://github.com/test-org/web-app",
          description: "Frontend application",
          releases: [
            {
              id: 3, repoName: "web-app",
              repoUrl: "https://github.com/test-org/web-app",
              tagName: "v1.5.0", name: "UI Refresh",
              body: "New look", htmlUrl: "https://github.com/test-org/web-app/releases/tag/v1.5.0",
              publishedAt: "2026-06-02T14:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev1", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/dev1" },
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

  it("index page contains a sidebar-right element", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('class="sidebar-right"');
  });

  it("sidebar-right lists developers alphabetically", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    const dev1Pos = html.indexOf("dev1");
    const dev2Pos = html.indexOf("dev2");
    // dev1 comes before dev2 alphabetically
    expect(dev1Pos).toBeLessThan(dev2Pos);
  });

  it("sidebar-right includes developer avatars", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    // Find the sidebar-right section specifically
    const sidebarStart = html.indexOf('class="sidebar-right"');
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    const sidebarHtml = html.slice(sidebarStart, sidebarEnd);
    expect(sidebarHtml).toContain("<img");
    expect(sidebarHtml).toContain("avatar");
  });

  it("sidebar-right links developers to their feed pages", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('href="developer/dev1/"');
    expect(html).toContain('href="developer/dev2/"');
  });

  it("repo page also contains the sidebar-right", () => {
    const html = readFileSync(join(outputDir, "api-service", "index.html"), "utf-8");
    expect(html).toContain('class="sidebar-right"');
  });

  it("repo page sidebar-right uses correct basePath for developer links", () => {
    const html = readFileSync(join(outputDir, "api-service", "index.html"), "utf-8");
    expect(html).toContain('href="../developer/dev1/"');
    expect(html).toContain('href="../developer/dev2/"');
  });
});

// ── Issue #24: right sidebar CSS ──────────────────────────────────────────

describe("right sidebar CSS", () => {
  it("style.css contains .sidebar-right rules", () => {
    const css = readFileSync(join(process.cwd(), "templates", "style.css"), "utf-8");
    expect(css).toContain(".sidebar-right");
  });

  it("style.css has sticky positioning for .sidebar-right", () => {
    const css = readFileSync(join(process.cwd(), "templates", "style.css"), "utf-8");
    // Should have position: sticky and top: 0 similar to left sidebar
    expect(css).toMatch(/\.sidebar-right\s*\{[^}]*position:\s*sticky/);
  });

  it("style.css has mobile styles for .sidebar-right", () => {
    const css = readFileSync(join(process.cwd(), "templates", "style.css"), "utf-8");
    // Inside a media query, .sidebar-right should change behavior
    const mediaMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/);
    expect(mediaMatch).not.toBeNull();
    expect(mediaMatch![1]).toContain(".sidebar-right");
  });
});

// ── Issue #24: developer page generation ─────────────────────────────────

describe("generateSite developer pages", () => {
  let tmpDir: string;
  let dataPath: string;
  let outputDir: string;
  const templatesDir = join(process.cwd(), "templates");

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-pages-test-"));
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
              id: 1, repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.1.0", name: "Release 2.1.0",
              body: "Changes", htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.1.0",
              publishedAt: "2026-06-03T10:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev1", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/dev1" },
            },
            {
              id: 2, repoName: "api-service",
              repoUrl: "https://github.com/test-org/api-service",
              tagName: "v2.0.0", name: "Release 2.0.0",
              body: "Major release", htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.0.0",
              publishedAt: "2026-05-01T10:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev2", avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4", htmlUrl: "https://github.com/dev2" },
            },
          ],
        },
        {
          name: "web-app",
          url: "https://github.com/test-org/web-app",
          description: "Frontend application",
          releases: [
            {
              id: 3, repoName: "web-app",
              repoUrl: "https://github.com/test-org/web-app",
              tagName: "v1.5.0", name: "UI Refresh",
              body: "New look", htmlUrl: "https://github.com/test-org/web-app/releases/tag/v1.5.0",
              publishedAt: "2026-06-02T14:00:00Z", isDraft: false, isPrerelease: false,
              author: { login: "dev1", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/dev1" },
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

  it("generates developer/dev1/index.html", () => {
    expect(existsSync(join(outputDir, "developer", "dev1", "index.html"))).toBe(true);
  });

  it("generates developer/dev2/index.html", () => {
    expect(existsSync(join(outputDir, "developer", "dev2", "index.html"))).toBe(true);
  });

  it("developer page contains the developer header", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    expect(html).toContain("developer-header");
  });

  it("developer page has correct basePath for stylesheet", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    expect(html).toContain('href="../../style.css"');
  });

  it("dev1 page shows only releases authored by dev1", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    // dev1 authored Release 2.1.0 and UI Refresh
    expect(html).toContain("Release 2.1.0");
    expect(html).toContain("UI Refresh");
    // dev1 did NOT author Release 2.0.0
    expect(html).not.toContain("Release 2.0.0");
  });

  it("dev2 page shows only releases authored by dev2", () => {
    const html = readFileSync(join(outputDir, "developer", "dev2", "index.html"), "utf-8");
    expect(html).toContain("Release 2.0.0");
    expect(html).not.toContain("Release 2.1.0");
    expect(html).not.toContain("UI Refresh");
  });

  it("developer page contains the left sidebar with repos", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    expect(html).toContain("api-service");
    expect(html).toContain("web-app");
  });

  it("developer page contains the right sidebar with developers", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    expect(html).toContain('class="sidebar-right"');
  });

  it("developer page has developer avatar", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    expect(html).toContain("developer-avatar");
  });

  it("developer page highlights the active developer in the right sidebar", () => {
    const html = readFileSync(join(outputDir, "developer", "dev1", "index.html"), "utf-8");
    // Find the sidebar-right section
    const sidebarStart = html.indexOf('class="sidebar-right"');
    expect(sidebarStart).toBeGreaterThan(-1);
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    const sidebarHtml = html.slice(sidebarStart, sidebarEnd);

    expect(sidebarHtml).toMatch(/href="[^"]*developer\/dev1\/"[^>]*class="user-pill dev-pill active"/);
    expect(sidebarHtml).not.toMatch(/href="[^"]*developer\/dev2\/"[^>]*class="user-pill dev-pill active"/);
  });

  it("index page does not highlight any developer in the right sidebar", () => {
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    const sidebarStart = html.indexOf('class="sidebar-right"');
    expect(sidebarStart).toBeGreaterThan(-1);
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    const sidebarHtml = html.slice(sidebarStart, sidebarEnd);

    expect(sidebarHtml).not.toContain("dev-pill active");
  });
});
