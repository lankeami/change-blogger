export interface Release {
  id: number;
  repoName: string;
  repoUrl: string;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
  isDraft: boolean;
  isPrerelease: boolean;
  author: {
    login: string;
    avatarUrl: string;
    htmlUrl: string;
  };
}

export interface RepoSummary {
  name: string;
  url: string;
  description: string;
  releases: Release[];
  latestRelease?: Release;
}

export interface SiteData {
  org: string;
  generatedAt: string;
  repos: RepoSummary[];
}

export interface Config {
  org: string;
  githubToken?: string;
  outputDir: string;
  siteTitle: string;
  siteUrl: string;
  excludeRepos?: string[];
  includeDraftReleases?: boolean;
}

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
