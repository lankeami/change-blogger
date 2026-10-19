import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { getConfig } from "./config.js";
import {
  createRenderer,
  getTimeBucket,
  getRelativeDate,
  renderMarkdown,
  type TimeBucket,
} from "./render.js";
import type { SiteData, Release, ReleaseCardData, TimeBucketData } from "./types.js";
import { writeFeedFiles } from "./feed.js";

export interface MarkdownReportOptions {
  dataPath: string;
  outputDir: string;
  siteTitle: string;
}

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

  // --- Copy stylesheet and static files ---
  const cssSource = join(templatesDir, "style.css");
  copyFileSync(cssSource, join(outputDir, "style.css"));

  const robotsSource = join(templatesDir, "robots.txt");
  copyFileSync(robotsSource, join(outputDir, "robots.txt"));

  // --- Atom feeds ---
  const feedConfig = {
    org: siteData.org,
    outputDir,
    siteTitle,
    siteUrl: options.siteUrl,
  };
  writeFeedFiles(siteData, feedConfig, outputDir, renderer);

  console.log(
    `Generated site: index + ${siteData.repos.length} repo pages + feeds → ${outputDir}/`,
  );
}

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

function formatDate(publishedAt: string): string {
  const d = new Date(publishedAt);
  return d.toISOString().slice(0, 10);
}

function escapeMarkdownTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export async function generateMarkdownReport(options: MarkdownReportOptions): Promise<void> {
  const { dataPath, outputDir, siteTitle } = options;

  if (!existsSync(dataPath)) {
    throw new Error(
      `${dataPath} not found. Run "npm run fetch" first to generate release data.`,
    );
  }

  const raw = readFileSync(dataPath, "utf-8");
  const siteData: SiteData = JSON.parse(raw);
  const now = new Date();

  const allReleases: Release[] = siteData.repos
    .flatMap((repo) => repo.releases)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  const bucketMap = new Map<TimeBucket, Release[]>();
  for (const bucket of BUCKET_ORDER) {
    bucketMap.set(bucket, []);
  }
  for (const release of allReleases) {
    const bucket = getTimeBucket(release.publishedAt, now);
    bucketMap.get(bucket)!.push(release);
  }

  const lines: string[] = [];
  lines.push(`# ${siteTitle}`);
  lines.push("");
  lines.push(`*Generated: ${siteData.generatedAt}*`);
  lines.push("");

  for (const bucket of BUCKET_ORDER) {
    const releases = bucketMap.get(bucket)!;
    if (releases.length === 0) continue;

    lines.push(`## ${BUCKET_LABELS[bucket]}`);
    lines.push("");
    lines.push("| Repo | Tag | Release Name | Date | Author |");
    lines.push("| --- | --- | --- | --- | --- |");

    for (const release of releases) {
      const repo = escapeMarkdownTableCell(release.repoName);
      const tag = escapeMarkdownTableCell(release.tagName);
      const name = escapeMarkdownTableCell(release.name);
      const date = formatDate(release.publishedAt);
      const author = escapeMarkdownTableCell(release.author.login);
      lines.push(`| ${repo} | ${tag} | ${name} | ${date} | ${author} |`);
    }

    lines.push("");

    // Details blocks for release bodies
    for (const release of releases) {
      if (!release.body || release.body.trim() === "") continue;
      lines.push(`<details>`);
      lines.push(`<summary>${release.repoName} ${release.tagName}</summary>`);
      lines.push("");
      lines.push(release.body);
      lines.push("");
      lines.push(`</details>`);
      lines.push("");
    }
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "releases.md"), lines.join("\n"));
  console.log(`Generated markdown report → ${join(outputDir, "releases.md")}`);
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

// Only run main when this file is the direct entry point (not imported as a module)
const isMain =
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(process.argv[1], "file://").pathname;

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
