import type { SiteData, Config, Release } from './types.js';

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface AtomEntry {
  title: string;
  id: string;
  published: string;
  updated: string;
  summary: string;
  link: string;
  author: {
    name: string;
  };
}

export interface AtomFeed {
  title: string;
  id: string;
  updated: string;
  link: string;
  generator: string;
  entries: AtomEntry[];
}

export function generateGlobalFeed(
  siteData: SiteData,
  config: Config
): AtomFeed {
  const allReleases = siteData.repos
    .flatMap(repo => repo.releases)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return {
    title: config.siteTitle,
    id: `urn:change-blogger:${config.org}:all`,
    updated: allReleases[0]?.publishedAt || new Date().toISOString(),
    link: config.siteUrl,
    generator: 'change-blogger v0.1.0',
    entries: allReleases.map(release => ({
      title: `${release.repoName} ${release.tagName}`,
      id: `urn:change-blogger:${config.org}:${release.repoName}:${release.id}`,
      published: release.publishedAt,
      updated: release.publishedAt,
      summary: release.name,
      link: `${config.siteUrl}/${release.repoName}#release-${release.tagName}`,
      author: { name: release.author.login },
    })),
  };
}

export function generateRepoFeed(
  repoName: string,
  releases: Release[],
  config: Config
): AtomFeed {
  const sorted = [...releases]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return {
    title: repoName,
    id: `urn:change-blogger:${config.org}:${repoName}`,
    updated: sorted[0]?.publishedAt || new Date().toISOString(),
    link: `${config.siteUrl}/${repoName}`,
    generator: 'change-blogger v0.1.0',
    entries: sorted.map(release => ({
      title: `${repoName} ${release.tagName}`,
      id: `urn:change-blogger:${config.org}:${repoName}:${release.id}`,
      published: release.publishedAt,
      updated: release.publishedAt,
      summary: release.name,
      link: `${config.siteUrl}/${repoName}#release-${release.tagName}`,
      author: { name: release.author.login },
    })),
  };
}
