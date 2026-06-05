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

  // --- Copy stylesheet ---
  const cssSource = join(templatesDir, "style.css");
  copyFileSync(cssSource, join(outputDir, "style.css"));

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
