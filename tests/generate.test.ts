import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateSite, generateReport } from "../src/generate.js";
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
