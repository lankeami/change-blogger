import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRenderer } from "../src/render.js";

describe("developer.eta template", () => {
  const templatesDir = join(process.cwd(), "templates");
  let renderer: ReturnType<typeof createRenderer>;

  beforeAll(() => {
    renderer = createRenderer(templatesDir);
  });

  const developer = {
    login: "octocat",
    name: "The Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    htmlUrl: "https://github.com/octocat",
  };

  const releases = [
    {
      repoName: "api-service",
      tagName: "v2.1.0",
      name: "Release 2.1.0",
      publishedAt: "2026-06-03T10:00:00Z",
      relativeDate: "yesterday",
      bodyHtml: "<p>Fixed a <strong>critical</strong> bug</p>",
      htmlUrl: "https://github.com/test-org/api-service/releases/tag/v2.1.0",
      author: {
        login: "octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        htmlUrl: "https://github.com/octocat",
      },
      authorPillHtml: '<a class="user-pill" href="https://github.com/octocat">The Octocat</a>',
    },
    {
      repoName: "web-app",
      tagName: "v1.5.0",
      name: "UI Refresh",
      publishedAt: "2026-06-02T14:00:00Z",
      relativeDate: "2 days ago",
      bodyHtml: "<p>New look</p>",
      htmlUrl: "https://github.com/test-org/web-app/releases/tag/v1.5.0",
      author: {
        login: "octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        htmlUrl: "https://github.com/octocat",
      },
      authorPillHtml: '<a class="user-pill" href="https://github.com/octocat">The Octocat</a>',
    },
  ];

  function renderDeveloperPage(data: Record<string, unknown>): string {
    return renderer.renderPage("developer", {
      siteTitle: "Test Changelog",
      pageTitle: "octocat",
      basePath: "../",
      repos: [{ name: "api-service" }, { name: "web-app" }],
      generatedAt: "2026-06-04T12:00:00Z",
      ...data,
    });
  }

  it("renders the developer template without errors", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("<!DOCTYPE html>");
  });

  // Header block tests
  it("renders the developer avatar in the header", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain(
      'src="https://avatars.githubusercontent.com/u/583231?v=4'
    );
    // The avatar should have the developer-avatar class
    expect(html).toContain("developer-avatar");
  });

  it("renders the display name as the page heading", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toMatch(/<h1[^>]*class="page-heading"[^>]*>.*The Octocat/s);
  });

  it("falls back to login when display name is null", () => {
    const devNoName = { ...developer, name: null };
    const html = renderDeveloperPage({ developer: devNoName, releases });
    expect(html).toMatch(/<h1[^>]*class="page-heading"[^>]*>.*octocat/s);
  });

  it("renders a GitHub profile link in the header", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain('href="https://github.com/octocat"');
    expect(html).toContain("View on GitHub");
  });

  it("wraps the header in a developer-header element", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("developer-header");
  });

  // Release cards tests
  it("renders release cards for all releases", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("Release 2.1.0");
    expect(html).toContain("UI Refresh");
  });

  it("renders repo badges on each release card (cross-repo context)", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("api-service");
    expect(html).toContain("web-app");
    // Should have repo-badge class links since we show releases from multiple repos
    expect(html).toContain("repo-badge");
  });

  it("renders release tags on each card", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("v2.1.0");
    expect(html).toContain("v1.5.0");
  });

  it("renders release dates on each card", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("yesterday");
    expect(html).toContain("2 days ago");
  });

  it("renders the release body HTML unescaped", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("<strong>critical</strong>");
    expect(html).toContain("New look");
  });

  it("renders the release link pointing to GitHub", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain(
      'href="https://github.com/test-org/api-service/releases/tag/v2.1.0"'
    );
  });

  it("wraps releases in a releases-list container", () => {
    const html = renderDeveloperPage({ developer, releases });
    expect(html).toContain("releases-list");
  });

  it("handles empty releases list", () => {
    const html = renderDeveloperPage({ developer, releases: [] });
    expect(html).toContain("developer-header");
    // Should still render without error
    expect(html).toContain("<!DOCTYPE html>");
  });

  // Active developer highlighting in right sidebar (issue #24)
  it("highlights the active developer in the right sidebar", () => {
    const developers = [
      { login: "alice", avatarUrl: "https://avatars/alice", htmlUrl: "https://github.com/alice" },
      { login: "octocat", avatarUrl: "https://avatars/octocat", htmlUrl: "https://github.com/octocat" },
    ];
    const html = renderDeveloperPage({
      developer,
      releases,
      developers,
      activeDeveloper: "octocat",
    });
    // The sidebar-right should exist and the octocat link should have the active class
    const sidebarStart = html.indexOf('class="sidebar-right"');
    expect(sidebarStart).toBeGreaterThan(-1);
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    const sidebarHtml = html.slice(sidebarStart, sidebarEnd);

    // The active developer link should have both dev-link and active classes
    expect(sidebarHtml).toMatch(/href="[^"]*developer\/octocat\/"[^>]*class="dev-link active"/);
  });

  it("does not highlight non-active developers in the right sidebar", () => {
    const developers = [
      { login: "alice", avatarUrl: "https://avatars/alice", htmlUrl: "https://github.com/alice" },
      { login: "octocat", avatarUrl: "https://avatars/octocat", htmlUrl: "https://github.com/octocat" },
    ];
    const html = renderDeveloperPage({
      developer,
      releases,
      developers,
      activeDeveloper: "octocat",
    });
    const sidebarStart = html.indexOf('class="sidebar-right"');
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    const sidebarHtml = html.slice(sidebarStart, sidebarEnd);

    // alice's link should NOT have the active class
    expect(sidebarHtml).toMatch(/href="[^"]*developer\/alice\/"[^>]*class="dev-link"[^"]*>/);
    expect(sidebarHtml).not.toMatch(/href="[^"]*developer\/alice\/"[^>]*class="dev-link active"/);
  });
});
