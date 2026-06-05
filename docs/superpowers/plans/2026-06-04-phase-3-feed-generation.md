# Phase 3: RSS/Atom Feed Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate Atom 1.0 feeds (global + per-repo) for Slack RSS integration.

**Architecture:** New `src/feed.ts` module with pure functions for feed generation (no I/O). Eta template `templates/feed.eta` renders Atom XML. Integration point in `generate.ts` calls `writeFeedFiles()` after HTML generation. New `Renderer.renderFeed()` method bridges feed data to template.

**Tech Stack:** Node.js (fs, path), TypeScript, Eta templating, vitest

---

## Task 1: Write failing unit tests for escapeXml()

**Files:**
- Create: `tests/feed.test.ts`

- [ ] **Step 1: Create test file with escapeXml tests**

Create `tests/feed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { escapeXml } from '../src/feed';

describe('escapeXml', () => {
  it('escapes less-than sign', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than sign', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('escapes ampersand', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quote', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quote', () => {
    expect(escapeXml("it's"esc)).toBe('it&apos;s');
  });

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  it('leaves alphanumeric unchanged', () => {
    expect(escapeXml('hello123')).toBe('hello123');
  });

  it('escapes multiple special chars', () => {
    expect(escapeXml('<tag attr="val" & name>'))
      .toBe('&lt;tag attr=&quot;val&quot; &amp; name&gt;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/feed.test.ts
```

Expected output: All 8 tests fail with "escapeXml is not exported from feed.ts" or similar.

---

## Task 2: Implement escapeXml() function

**Files:**
- Create: `src/feed.ts`

- [ ] **Step 1: Create feed.ts with escapeXml implementation**

Create `src/feed.ts`:

```typescript
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test tests/feed.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/feed.ts tests/feed.test.ts
git commit -m "feat(feed): add escapeXml utility"
```

---

## Task 3: Write failing tests for generateGlobalFeed()

**Files:**
- Modify: `tests/feed.test.ts`

- [ ] **Step 1: Add generateGlobalFeed tests**

Add to `tests/feed.test.ts` (after escapeXml tests):

```typescript
import { generateGlobalFeed } from '../src/feed';
import type { SiteData, Config } from '../src/types';

describe('generateGlobalFeed', () => {
  const mockConfig: Config = {
    org: 'test-org',
    outputDir: 'site',
    siteTitle: 'Test Changelog',
    siteUrl: 'https://example.com',
  };

  const mockSiteData: SiteData = {
    org: 'test-org',
    generatedAt: '2026-06-04T10:00:00Z',
    repos: [
      {
        name: 'api',
        url: 'https://github.com/test-org/api',
        description: 'API repository',
        releases: [
          {
            id: 123,
            repoName: 'api',
            repoUrl: 'https://github.com/test-org/api',
            tagName: 'v1.0.0',
            name: 'Initial release',
            body: 'First release',
            htmlUrl: 'https://github.com/test-org/api/releases/tag/v1.0.0',
            publishedAt: '2026-06-04T10:00:00Z',
            isDraft: false,
            isPrerelease: false,
            author: { login: 'alice', avatarUrl: 'https://...', htmlUrl: 'https://...' },
          },
        ],
      },
      {
        name: 'web',
        url: 'https://github.com/test-org/web',
        description: 'Web repository',
        releases: [
          {
            id: 456,
            repoName: 'web',
            repoUrl: 'https://github.com/test-org/web',
            tagName: 'v2.0.0',
            name: 'Major update',
            body: 'Breaking changes',
            htmlUrl: 'https://github.com/test-org/web/releases/tag/v2.0.0',
            publishedAt: '2026-06-05T10:00:00Z',
            isDraft: false,
            isPrerelease: false,
            author: { login: 'bob', avatarUrl: 'https://...', htmlUrl: 'https://...' },
          },
        ],
      },
    ],
  };

  it('returns feed with correct title', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.title).toBe('Test Changelog');
  });

  it('returns feed with org-scoped ID', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.id).toBe('urn:change-blogger:test-org:all');
  });

  it('returns feed with updated timestamp of newest release', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.updated).toBe('2026-06-05T10:00:00Z');
  });

  it('includes link to site URL', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.link).toBe('https://example.com');
  });

  it('includes all releases sorted by date descending', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries).toHaveLength(2);
    expect(feed.entries[0].title).toBe('web v2.0.0'); // newer first
    expect(feed.entries[1].title).toBe('api v1.0.0');
  });

  it('entry title is "{repoName} {tagName}"', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].title).toBe('web v2.0.0');
  });

  it('entry ID is stable URN with release ID', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].id).toBe('urn:change-blogger:test-org:web:456');
  });

  it('entry includes published date', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].published).toBe('2026-06-05T10:00:00Z');
  });

  it('entry updated equals published (no content changes)', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].updated).toBe(feed.entries[0].published);
  });

  it('entry summary is release name', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].summary).toBe('Major update');
  });

  it('entry link includes repo and anchored tag', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].link).toBe('https://example.com/web#release-v2.0.0');
  });

  it('entry author is GitHub login', () => {
    const feed = generateGlobalFeed(mockSiteData, mockConfig);
    expect(feed.entries[0].author.name).toBe('bob');
  });

  it('caps entries at 50', () => {
    // Create mock data with 60 releases
    const largeData: SiteData = {
      ...mockSiteData,
      repos: [
        {
          ...mockSiteData.repos[0],
          releases: Array.from({ length: 60 }, (_, i) => ({
            id: 1000 + i,
            repoName: 'api',
            repoUrl: 'https://github.com/test-org/api',
            tagName: `v${i}`,
            name: `Release ${i}`,
            body: '',
            htmlUrl: 'https://...',
            publishedAt: new Date(2026, 5, 4, 10, 0, 0 - i * 3600000).toISOString(),
            isDraft: false,
            isPrerelease: false,
            author: { login: 'test', avatarUrl: 'https://...', htmlUrl: 'https://...' },
          })),
        },
      ],
    };
    const feed = generateGlobalFeed(largeData, mockConfig);
    expect(feed.entries).toHaveLength(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/feed.test.ts
```

Expected: All generateGlobalFeed tests fail with "generateGlobalFeed is not exported".

---

## Task 4: Implement generateGlobalFeed()

**Files:**
- Modify: `src/feed.ts`

- [ ] **Step 1: Import types and add generateGlobalFeed**

Update `src/feed.ts`:

```typescript
import type { Release, SiteData, Config } from './types';

export interface AtomFeed {
  title: string;
  id: string;
  updated: string;
  link: string;
  generator: string;
  entries: AtomEntry[];
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test tests/feed.test.ts
```

Expected: All generateGlobalFeed tests pass. (escapeXml tests still pass too.)

- [ ] **Step 3: Commit**

```bash
git add src/feed.ts tests/feed.test.ts
git commit -m "feat(feed): implement generateGlobalFeed()"
```

---

## Task 5: Write failing tests for generateRepoFeed()

**Files:**
- Modify: `tests/feed.test.ts`

- [ ] **Step 1: Add generateRepoFeed tests**

Add to `tests/feed.test.ts` (after generateGlobalFeed tests):

```typescript
import { generateRepoFeed } from '../src/feed';

describe('generateRepoFeed', () => {
  const mockConfig: Config = {
    org: 'test-org',
    outputDir: 'site',
    siteTitle: 'Test Changelog',
    siteUrl: 'https://example.com',
  };

  const mockReleases: Release[] = [
    {
      id: 123,
      repoName: 'api',
      repoUrl: 'https://github.com/test-org/api',
      tagName: 'v1.0.0',
      name: 'Initial release',
      body: 'First release',
      htmlUrl: 'https://github.com/test-org/api/releases/tag/v1.0.0',
      publishedAt: '2026-06-04T10:00:00Z',
      isDraft: false,
      isPrerelease: false,
      author: { login: 'alice', avatarUrl: 'https://...', htmlUrl: 'https://...' },
    },
    {
      id: 124,
      repoName: 'api',
      repoUrl: 'https://github.com/test-org/api',
      tagName: 'v1.1.0',
      name: 'Bug fixes',
      body: 'Fixed bugs',
      htmlUrl: 'https://github.com/test-org/api/releases/tag/v1.1.0',
      publishedAt: '2026-06-05T10:00:00Z',
      isDraft: false,
      isPrerelease: false,
      author: { login: 'bob', avatarUrl: 'https://...', htmlUrl: 'https://...' },
    },
  ];

  it('returns feed with repo name as title', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.title).toBe('api');
  });

  it('returns feed with repo-scoped ID', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.id).toBe('urn:change-blogger:test-org:api');
  });

  it('returns feed with updated timestamp of newest release', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.updated).toBe('2026-06-05T10:00:00Z');
  });

  it('includes repo-specific link', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.link).toBe('https://example.com/api');
  });

  it('includes all releases for repo sorted by date descending', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.entries).toHaveLength(2);
    expect(feed.entries[0].title).toBe('api v1.1.0');
    expect(feed.entries[1].title).toBe('api v1.0.0');
  });

  it('entry includes author login', () => {
    const feed = generateRepoFeed('api', mockReleases, mockConfig);
    expect(feed.entries[0].author.name).toBe('bob');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/feed.test.ts
```

Expected: All generateRepoFeed tests fail with "generateRepoFeed is not exported".

---

## Task 6: Implement generateRepoFeed()

**Files:**
- Modify: `src/feed.ts`

- [ ] **Step 1: Add generateRepoFeed function**

Add to `src/feed.ts` (after generateGlobalFeed):

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test tests/feed.test.ts
```

Expected: All feed generation tests pass (escapeXml, generateGlobalFeed, generateRepoFeed).

- [ ] **Step 3: Commit**

```bash
git add src/feed.ts tests/feed.test.ts
git commit -m "feat(feed): implement generateRepoFeed()"
```

---

## Task 7: Create feed.eta Atom XML template

**Files:**
- Create: `templates/feed.eta`

- [ ] **Step 1: Create Atom 1.0 template**

Create `templates/feed.eta`:

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

- [ ] **Step 2: Commit**

```bash
git add templates/feed.eta
git commit -m "feat(templates): add Atom 1.0 feed template"
```

---

## Task 8: Add renderFeed() method to Renderer

**Files:**
- Modify: `src/render.ts`

- [ ] **Step 1: Add renderFeed method to Renderer class**

Update `src/render.ts` — find the `Renderer` class and add this method:

```typescript
renderFeed(feedData: AtomFeed): string {
  return this.eta.render(this.templates['feed.eta'], feedData);
}
```

Also add the import at the top of the file:

```typescript
import type { AtomFeed } from './feed';
```

- [ ] **Step 2: Verify type checking**

```bash
npm run build
```

Expected: TypeScript compilation succeeds (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/render.ts
git commit -m "feat(render): add renderFeed() method for Atom templates"
```

---

## Task 9: Write failing test for writeFeedFiles()

**Files:**
- Modify: `tests/feed.test.ts`

- [ ] **Step 1: Add writeFeedFiles test**

Add to `tests/feed.test.ts` (after generateRepoFeed tests):

```typescript
import { writeFeedFiles } from '../src/feed';
import fs from 'fs';
import path from 'path';
import { createRenderer } from '../src/render';

describe('writeFeedFiles', () => {
  const mockConfig: Config = {
    org: 'test-org',
    outputDir: 'site',
    siteTitle: 'Test Changelog',
    siteUrl: 'https://example.com',
  };

  const mockSiteData: SiteData = {
    org: 'test-org',
    generatedAt: '2026-06-04T10:00:00Z',
    repos: [
      {
        name: 'api',
        url: 'https://github.com/test-org/api',
        description: 'API',
        releases: [
          {
            id: 123,
            repoName: 'api',
            repoUrl: 'https://github.com/test-org/api',
            tagName: 'v1.0.0',
            name: 'Initial',
            body: 'First',
            htmlUrl: 'https://github.com/test-org/api/releases/tag/v1.0.0',
            publishedAt: '2026-06-04T10:00:00Z',
            isDraft: false,
            isPrerelease: false,
            author: { login: 'alice', avatarUrl: 'https://...', htmlUrl: 'https://...' },
          },
        ],
      },
    ],
  };

  it('writes global feed to site/feed.xml', () => {
    const tmpDir = 'test-output-feeds';
    const renderer = createRenderer('templates');

    writeFeedFiles(mockSiteData, mockConfig, tmpDir, renderer);

    const globalFeedPath = path.join(tmpDir, 'feed.xml');
    expect(fs.existsSync(globalFeedPath)).toBe(true);

    const content = fs.readFileSync(globalFeedPath, 'utf-8');
    expect(content).toContain('<?xml version="1.0"');
    expect(content).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(content).toContain('Test Changelog');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes per-repo feed to site/{repo}/feed.xml', () => {
    const tmpDir = 'test-output-feeds';
    const renderer = createRenderer('templates');

    writeFeedFiles(mockSiteData, mockConfig, tmpDir, renderer);

    const repoFeedPath = path.join(tmpDir, 'api', 'feed.xml');
    expect(fs.existsSync(repoFeedPath)).toBe(true);

    const content = fs.readFileSync(repoFeedPath, 'utf-8');
    expect(content).toContain('<title><![CDATA[api]]></title>');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/feed.test.ts
```

Expected: writeFeedFiles tests fail with "writeFeedFiles is not exported".

---

## Task 10: Implement writeFeedFiles()

**Files:**
- Modify: `src/feed.ts`

- [ ] **Step 1: Add fs/path imports and writeFeedFiles**

Add to top of `src/feed.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import type { Renderer } from './render';
```

Then add the function (after generateRepoFeed):

```typescript
export function writeFeedFiles(
  siteData: SiteData,
  config: Config,
  outputDir: string,
  renderer: Renderer
): void {
  const globalFeed = generateGlobalFeed(siteData, config);
  const globalFeedXml = renderer.renderFeed(globalFeed);
  fs.writeFileSync(path.join(outputDir, 'feed.xml'), globalFeedXml);

  siteData.repos.forEach(repo => {
    const repoFeed = generateRepoFeed(repo.name, repo.releases, config);
    const repoFeedXml = renderer.renderFeed(repoFeed);
    const repoDir = path.join(outputDir, repo.name);
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'feed.xml'), repoFeedXml);
  });
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test tests/feed.test.ts
```

Expected: All feed module tests pass (30+ tests total).

- [ ] **Step 3: Commit**

```bash
git add src/feed.ts tests/feed.test.ts
git commit -m "feat(feed): implement writeFeedFiles() for disk I/O"
```

---

## Task 11: Integrate feed generation into generate.ts

**Files:**
- Modify: `src/generate.ts`

- [ ] **Step 1: Add import and call to writeFeedFiles**

Update `src/generate.ts` — add import near top:

```typescript
import { writeFeedFiles } from './feed';
```

Then find the `main()` function. Locate where `generateHTML()` is called. After that call, add:

```typescript
writeFeedFiles(siteData, config, outputDir, renderer);
```

The sequence should look like:

```typescript
async function main(): Promise<void> {
  const config = loadConfig();
  const dataFile = path.join('data', 'releases.json');
  
  if (!fs.existsSync(dataFile)) {
    console.error(`No releases data. Run: npm run fetch`);
    process.exit(1);
  }

  const outputDir = config.outputDir || 'site';
  fs.rmSync(outputDir, { recursive: true, force: true });

  const siteData = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as SiteData;
  const renderer = createRenderer('templates');

  generateHTML(siteData, config, outputDir, renderer);
  writeFeedFiles(siteData, config, outputDir, renderer);  // <-- NEW

  console.log(`Site generated to ${outputDir}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No type errors.

- [ ] **Step 3: Test locally (manual check)**

```bash
npm run build:site
```

Expected: `site/feed.xml` and `site/{repo-name}/feed.xml` files exist and contain valid XML.

Check one:

```bash
head -20 site/feed.xml
```

Should show Atom XML with correct title, entries, etc.

- [ ] **Step 4: Commit**

```bash
git add src/generate.ts
git commit -m "feat(generate): integrate feed generation into main pipeline"
```

---

## Task 12: Add integration tests for feeds

**Files:**
- Modify: `tests/generate.test.ts`

- [ ] **Step 1: Add feed generation assertions to integration test**

Update `tests/generate.test.ts` — find the existing `describe('generate'...)` block. Add a new test after the HTML generation tests:

```typescript
it('generates feed.xml in output directory', async () => {
  const tmpDir = path.join('test-output-generate');
  const testConfig = {
    org: 'test-org',
    outputDir: tmpDir,
    siteTitle: 'Test Changelog',
    siteUrl: 'https://example.com',
  };

  const siteData = createFixtureSiteData();
  const renderer = createRenderer('templates');

  generateHTML(siteData, testConfig, tmpDir, renderer);
  writeFeedFiles(siteData, testConfig, tmpDir, renderer);

  const feedPath = path.join(tmpDir, 'feed.xml');
  expect(fs.existsSync(feedPath)).toBe(true);

  const feedContent = fs.readFileSync(feedPath, 'utf-8');
  expect(feedContent).toContain('<?xml version="1.0"');
  expect(feedContent).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  expect(feedContent).toContain('<entry>');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

it('generates per-repo feeds', async () => {
  const tmpDir = path.join('test-output-generate-repo');
  const testConfig = {
    org: 'test-org',
    outputDir: tmpDir,
    siteTitle: 'Test Changelog',
    siteUrl: 'https://example.com',
  };

  const siteData = createFixtureSiteData();
  const renderer = createRenderer('templates');

  generateHTML(siteData, testConfig, tmpDir, renderer);
  writeFeedFiles(siteData, testConfig, tmpDir, renderer);

  const repoFeedPath = path.join(tmpDir, 'bedding-core', 'feed.xml');
  expect(fs.existsSync(repoFeedPath)).toBe(true);

  const feedContent = fs.readFileSync(repoFeedPath, 'utf-8');
  expect(feedContent).toContain('<title><![CDATA[bedding-core]]></title>');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});
```

(Note: `createFixtureSiteData()` should already exist in your test file from phase 2. If not, create it with sample release data.)

- [ ] **Step 2: Add imports if needed**

Ensure `writeFeedFiles` is imported at top of test file:

```typescript
import { writeFeedFiles } from '../src/feed';
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass (50+ tests total).

- [ ] **Step 4: Commit**

```bash
git add tests/generate.test.ts
git commit -m "test(feed): add integration tests for feed generation"
```

---

## Task 13: Final verification and type checking

**Files:**
- No files to modify

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run type check**

```bash
npm run build
```

Expected: TypeScript compilation succeeds.

- [ ] **Step 3: Build site end-to-end**

```bash
npm run build:site
```

Expected:
- No errors
- `site/feed.xml` exists (global feed)
- `site/{repo-name}/feed.xml` exists for each repo with releases
- Feed XML is valid (can be parsed)

- [ ] **Step 4: Verify feed XML is valid (optional)**

```bash
# Install xmllint if needed: brew install libxml2 (macOS)
xmllint --noout site/feed.xml
```

Expected: No XML validation errors.

- [ ] **Step 5: Commit**

```bash
git status  # should be clean
echo "Phase 3 implementation complete"
```

---

## Summary

**Modules created:**
- `src/feed.ts` — feed generation (escapeXml, generateGlobalFeed, generateRepoFeed, writeFeedFiles)
- `templates/feed.eta` — Atom 1.0 XML template

**Modules modified:**
- `src/render.ts` — added renderFeed() method
- `src/generate.ts` — integrated feed generation into main pipeline
- `tests/feed.test.ts` — 20+ unit tests for all feed functions
- `tests/generate.test.ts` — 2+ integration tests for feed output

**Commits:** 7 commits (one per feature + one for integration + one for tests)

**Test coverage:** ~100% of feed module (escapeXml, feed generation, file I/O)

**Dependencies:** None added (uses existing Node.js fs/path, Eta templating)
