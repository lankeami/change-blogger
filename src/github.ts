import { Octokit } from "@octokit/rest";
import type { Release } from "./types.js";

export function createClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchOrgRepos(
  octokit: Octokit,
  org: string
): Promise<Array<{ name: string; url: string; description: string }>> {
  const repos: Array<{ name: string; url: string; description: string }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listForOrg,
    { org, per_page: 100, type: "sources" }
  )) {
    for (const repo of response.data) {
      if (repo.archived) continue;
      repos.push({
        name: repo.name,
        url: repo.html_url,
        description: repo.description || "",
      });
    }
  }

  repos.sort((a, b) => a.name.localeCompare(b.name));

  const rateLimit = await octokit.rest.rateLimit.get();
  const remaining = rateLimit.data.rate.remaining;
  console.log(`  Rate limit remaining: ${remaining}`);

  return repos;
}

export async function fetchRepoReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
  includeDrafts: boolean
): Promise<Release[]> {
  const releases: Release[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listReleases,
    { owner, repo, per_page: 100 }
  )) {
    for (const rel of response.data) {
      if (rel.draft && !includeDrafts) continue;

      releases.push({
        id: rel.id,
        repoName: repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
        tagName: rel.tag_name,
        name: rel.name || rel.tag_name,
        body: rel.body || "",
        htmlUrl: rel.html_url,
        publishedAt: rel.published_at || rel.created_at,
        isDraft: rel.draft ?? false,
        isPrerelease: rel.prerelease,
        author: {
          login: rel.author?.login || "unknown",
          avatarUrl: rel.author?.avatar_url || "",
          htmlUrl: rel.author?.html_url || "",
        },
      });
    }
  }

  releases.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return releases;
}
