# Phase 3: RSS/Atom Feed Generation — Design Spec

**Date:** 2026-06-04  
**Phase:** 3  
**Status:** Design Approved  
**Author:** Jay Chinthrajah

---

## Overview

Phase 3 adds Atom 1.0 feed generation to change-blogger. Teams can subscribe to feeds via Slack's RSS integration, email, or personal feed readers. Two feed types: one global feed (all releases) and per-repo feeds (releases for a specific repository).

**Primary Use Case:** Slack notifications. A Slack channel subscribes to `site/feed.xml`, and new releases appear as threaded messages.

**Out of Scope:** Webhooks, email automation, complex filtering. Those belong to Phase 4 (GitHub Actions) or future phases.

---

## Requirements

### Functional

1. **Global Atom Feed**
   - Single feed at `site/feed.xml` containing all releases from all repos
   - Sorted by `publishedAt` descending (newest first)
   - Capped at 50 most recent entries
   - Each entry includes: title (repo + tag), summary, link, author, publication date

2. **Per-Repo Feeds**
   - One feed per repository at `site/{repo-name}/feed.xml`
   - Contains only releases from that repo
   - Same sorting and entry cap as global feed

3. **Feed Format**
   - Atom 1.0 (RFC 4287) — modern, cleaner than RSS 2.0, native ISO 8601 date support
   - Valid XML output that Slack's RSS integration can parse
   - CDATA-wrapped text where needed (titles with `<`, `>`, `&`)

4. **Entry Content**
   - Title: `{repoName} {tagName}` (e.g., "bedding-api v2.1.0")
   - Summary: Release name/description (human-readable title)
   - Link: URL to release card on the changelog page (anchored by tag)
   - Author: GitHub login of release creator
   - Published/Updated: ISO 8601 timestamps (from release's `publishedAt`)

5. **Feed Metadata**
   - Global feed title: from `config.siteTitle` (e.g., "Changelog")
   - Per-repo feed title: repository name
   - Updated timestamp: most recent release in that feed
   - ID (URN): `urn:change-blogger:{org}:{scope}` (global or per-repo)
   - Generator: change-blogger v0.x.x

### Non-Functional

- **No new dependencies** — use Node.js built-ins + existing Eta templating
- **Zero config changes** — feeds are automatic, no feature flags needed
- **Performance** — feed generation should take <100ms for 50 entries
- **Accessibility** — feeds are structured XML, no special accessibility needs

### Constraints

- Slack RSS integration truncates long content — feeds include summary only, not full markdown
- Feed readers expect consistent, valid Atom structure
- Entry IDs must be stable (same release = same ID across feed updates)

---

## Design

### Architecture

```
┌─────────────────────────────────────────────┐
│         generate.ts (entry point)           │
│                                             │
│  1. Read data/releases.json                 │
│  2. generateHTML() [existing]               │
│  3. generateFeeds() [new]                   │
│      ├─ Call feed.ts functions             │
│      └─ Write XML to site/                 │
└─────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────┐
         │      src/feed.ts (new module)      │
         │                                    │
         │ • escapeXml()                      │
         │ • generateGlobalFeed()             │
         │ • generateRepoFeed()               │
         │ • writeFeedFiles()                 │
         └─────────────────────────────────────┘
         │
         ├─────────────────────────────────────┐
         │   templates/feed.eta (new)          │
         │                                    │
         │ Atom 1.0 XML skeleton with         │
         │ feed + entries                     │
         └─────────────────────────────────────┘
         │
         └─────────────────────────────────────┐
         │    site/feed.xml [output]          │
         │    site/{repo}/feed.xml [output]   │
         └─────────────────────────────────────┘
```

### Data Flow

1. **Generate feeds in memory**
   - Read sorted `SiteData` from JSON
   - Group releases: all (global) + by repo (per-repo)
   - Build feed objects with title, id, updated, entries

2. **Render via Eta template**
   - Pass feed object to `templates/feed.eta`
   - Template outputs valid Atom 1.0 XML
   - Eta handles XML escaping via CDATA

3. **Write to disk**
   - Global: `outputDir/feed.xml`
   - Per-repo: `outputDir/{repo-name}/feed.xml`

### Module: `src/feed.ts`

```typescript
// Utility: XML escaping for text content and attributes
function escapeXml(str: string): string {
  // Replace <, >, &, ", ' with XML entities
}

// Data structure for Atom feed
interface AtomFeed {
  title: string;
  id: string;
  updated: string;           // ISO 8601
  link: string;              // siteUrl
  generator: string;         // "change-blogger v0.1.0"
  entries: AtomEntry[];      // capped at 50
}

interface AtomEntry {
  title: string;             // "{repoName} {tagName}"
  id: string;                // "urn:change-blogger:org:repo:releaseId"
  published: string;         // ISO 8601
  updated: string;           // same as published
  summary: string;           // release.name (description)
  link: string;              // URL to release card
  author: {
    name: string;            // author.login
  };
}

// Generate global feed
function generateGlobalFeed(
  siteData: SiteData,
  config: Config
): AtomFeed {
  const allReleases = siteData.repos
    .flatMap(r => r.releases)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return {
    title: config.siteTitle,
    id: `urn:change-blogger:${config.org}:all`,
    updated: allReleases[0]?.publishedAt || new Date().toISOString(),
    link: config.siteUrl,
    generator: "change-blogger v0.1.0",
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

// Generate per-repo feed
function generateRepoFeed(
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
    generator: "change-blogger v0.1.0",
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

// Orchestrate feed generation and file writes
function writeFeedFiles(
  siteData: SiteData,
  config: Config,
  outputDir: string,
  renderer: Renderer  // from src/render.ts
): void {
  const globalFeed = generateGlobalFeed(siteData, config);
  
  // Write global feed
  const globalFeedXml = renderer.renderFeed(globalFeed);
  fs.writeFileSync(path.join(outputDir, 'feed.xml'), globalFeedXml);

  // Write per-repo feeds
  siteData.repos.forEach(repo => {
    const repoFeed = generateRepoFeed(repo.name, repo.releases, config);
    const repoFeedXml = renderer.renderFeed(repoFeed);
    const repoDir = path.join(outputDir, repo.name);
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'feed.xml'), repoFeedXml);
  });
}
```

### Template: `templates/feed.eta`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[<%~ it.title %>]]></title>
  <id><%~ it.id %></id>
  <updated><%~ it.updated %></updated>
  <link href="<%~ it.link %>" rel="alternate" />
  <generator><%~ it.generator %></generator>
  
  <% it.entries.forEach(entry => { %>
  <entry>
    <title><![CDATA[<%~ entry.title %>]]></title>
    <id><%~ entry.id %></id>
    <published><%~ entry.published %></published>
    <updated><%~ entry.updated %></updated>
    <summary><![CDATA[<%~ entry.summary %>]]></summary>
    <link href="<%~ entry.link %>" rel="alternate" />
    <author>
      <name><%~ entry.author.name %></name>
    </author>
  </entry>
  <% }); %>
</feed>
```

### Integration in `generate.ts`

```typescript
// After HTML generation:
import { writeFeedFiles } from './feed.js';

// ...in main():
const siteData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
const renderer = createRenderer(templatesDir);

generateHTML(siteData, config, outputDir, renderer);
writeFeedFiles(siteData, config, outputDir, renderer);  // NEW

console.log(`Site generated to ${outputDir}`);
```

### Integration in HTML (`layout.eta`)

Optional: add feed discovery link to page `<head>` so feed readers auto-discover the feed.

```html
<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="Changelog" />
<link rel="alternate" type="application/atom+xml" href="/repo-name/feed.xml" title="repo-name" />
<!-- per-repo page only -->
```

This is nice-to-have but not required for Slack integration.

---

## Testing

### Unit Tests (`tests/feed.test.ts`)

**escapeXml():**
- Escapes `<`, `>`, `&`, `"`, `'`
- Handles empty strings
- Leaves alphanumeric text unchanged

**Feed generation:**
- `generateGlobalFeed()`: validates title, id, updated, entry count
- `generateRepoFeed()`: validates title scoped to repo, correct entries
- Entry sorting: newest first
- Entry capping: max 50 entries
- URLs: correct format with anchors
- ISO 8601 dates: valid format

**Renderer:**
- `renderer.renderFeed()` returns valid XML (can parse with native XML parser)
- CDATA wrapping: titles/summaries with special chars are wrapped

### Integration Tests (`tests/generate.test.ts`)

- Full pipeline: `npm run build:site` generates both HTML and feeds
- Verify global feed XML is valid and parseable
- Verify per-repo feeds exist for each repo
- Verify feed entry counts match release counts (capped at 50)
- Verify Slack RSS integration can parse output (optional: mock Slack parser)

---

## Success Criteria

1. ✅ `site/feed.xml` is valid Atom 1.0 and parseable by Slack
2. ✅ Per-repo feeds exist and contain correct releases
3. ✅ Feed entries are sorted descending by date
4. ✅ Feed updated timestamp reflects newest release
5. ✅ No new npm dependencies
6. ✅ 100% test coverage for feed module
7. ✅ Feed generation <100ms on typical dataset (100 repos, 1000 releases)

---

## Rollout & Next Steps

- **Phase 3 (this phase):** Atom feed generation
- **Phase 4:** GitHub Actions CI/CD — automate `npm run build:site` on release events
- **Phase 5:** OAuth gate for internal team (optional, post-GA)

---

## Assumptions & Decisions

1. **Atom 1.0 over RSS 2.0:** Atom has native ISO 8601 date support; RSS requires RFC 822 conversion
2. **Hand-built XML over `feed` package:** No new dependencies; Eta templates handle structure and escaping
3. **Summary only, not full markdown:** Slack truncates long content; summary links to full page
4. **50-entry cap:** Slack and most feed readers display recent entries; prevents bloat
5. **Stable URN IDs:** Releases have stable GitHub IDs (`release.id`); allows feed deduplication
6. **No filtering in feeds:** All releases visible (unless excluded from HTML). Per-repo feeds provide granularity
