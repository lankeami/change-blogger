import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "./config.js";
import { createClient, fetchOrgRepos, fetchRepoReleases } from "./github.js";
import type { RepoSummary, SiteData } from "./types.js";

async function main(): Promise<void> {
  const config = getConfig();

  if (!config.githubToken) {
    console.error("GitHub token required. Set 'githubToken' in config.json or GITHUB_TOKEN env var.");
    process.exit(1);
  }

  const octokit = createClient(config.githubToken);
  const excludeSet = new Set(config.excludeRepos || []);

  console.log(`Fetching repos for org ${config.org}...`);
  const allRepos = await fetchOrgRepos(octokit, config.org);
  const repos = allRepos.filter((r) => !excludeSet.has(r.name));
  console.log(`Found ${repos.length} repos (${allRepos.length - repos.length} excluded)`);

  const repoSummaries: RepoSummary[] = [];
  let totalReleases = 0;

  for (const repo of repos) {
    const releases = await fetchRepoReleases(
      octokit,
      config.org,
      repo.name,
      config.includeDraftReleases ?? false
    );
    console.log(`  Fetching releases for ${repo.name} (${releases.length} releases)`);
    totalReleases += releases.length;

    if (releases.length > 0) {
      repoSummaries.push({
        name: repo.name,
        url: repo.url,
        description: repo.description,
        releases,
        latestRelease: releases[0],
      });
    }
  }

  const siteData: SiteData = {
    org: config.org,
    generatedAt: new Date().toISOString(),
    repos: repoSummaries,
  };

  const dataDir = resolve(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const outPath = resolve(dataDir, "releases.json");
  writeFileSync(outPath, JSON.stringify(siteData, null, 2));
  console.log(`Wrote ${totalReleases} releases across ${repoSummaries.length} repos to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
