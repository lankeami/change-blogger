import { describe, it, expect } from 'vitest';
import { escapeXml, generateGlobalFeed } from '../src/feed';
import type { SiteData, Config } from '../src/types';

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
    expect(escapeXml("it's")).toBe('it&apos;s');
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
    expect(feed.entries[0].title).toBe('web v2.0.0');
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

  it('entry updated equals published', () => {
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
