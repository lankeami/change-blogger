# Phase 2: HTML Generation — Design Spec

## Overview

Phase 2 adds a static HTML generation pipeline to change-blogger. It reads the `data/releases.json` produced by Phase 1's fetch script and outputs a branded, navigable static site to the configured `outputDir` (default: `site/`).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design philosophy | Styled & branded | Polished product site, not a raw data dump |
| Default audience | Internal engineering team | Engineers scanning "what shipped this week" |
| Audience configurability | Template-layer swapping | Different `.eta` template sets for different audiences; no second theme built now |
| Index page layout | Grouped by time period | "This Week", "Last Week", "Older" buckets |
| Repo page layout | Chronological | Flat newest-first list of all releases for that repo |
| Template engine | Eta | Lightweight (~3KB), TypeScript-native, async support, `.eta` file templates |
| Markdown renderer | marked | Mature, fast, good TypeScript types, GFM support |
| CSS approach | Custom `style.css` | No framework; dark-on-light, card-based, responsive with one breakpoint |

## Architecture

```
data/releases.json  ->  src/generate.ts  ->  site/
                            |                  |- index.html
                        templates/             |- style.css
                        |- layout.eta          |- {repo-name}/
                        |- index.eta           |   \- index.html
                        \- repo.eta            \- {repo-name-2}/
                                                   \- index.html
```

### Modules

| Module | Responsibility |
|--------|---------------|
| `src/generate.ts` | Entry point. Reads `data/releases.json`, orchestrates rendering, writes HTML files, copies `style.css` to output. |
| `src/render.ts` | Eta engine configuration, marked configuration, helper functions (date formatting, time-period bucketing). Exposes `renderPage(template, data)`. |
| `templates/layout.eta` | Shared HTML shell: `<head>`, nav bar, footer, body slot. |
| `templates/index.eta` | Index page body: time-bucketed release cards. |
| `templates/repo.eta` | Repo page body: chronological release list. |
| `templates/style.css` | Branded stylesheet, copied verbatim to output. |

### Separation of concerns

- `generate.ts` owns I/O: reading JSON, writing files, creating directories, copying assets.
- `render.ts` owns logic: configuring Eta and marked, exposing a render function, providing template helpers.
- Templates own HTML structure: layout, cards, navigation markup.

## Pages

### Index page (`site/index.html`)

Collects all releases from all repos, sorts by `publishedAt` descending, then buckets into time periods relative to the generation date:

- **This Week** — releases from the current ISO week (Monday-Sunday)
- **Last Week** — releases from the previous ISO week
- **Older** — everything else

Each release renders as a card showing:
- Repo name (as a badge/link to the repo's page)
- Release name and tag
- Author avatar (small circle) + login
- Relative date (e.g., "2 days ago")
- Markdown body rendered to HTML

Empty time buckets are omitted from the page.

### Repo pages (`site/{repo-name}/index.html`)

Flat chronological list (newest first) of all releases for that repo. Same card format as the index page but without the repo name badge (redundant on the repo's own page).

Page header includes:
- Repo name as the heading
- Repo description
- Link to the GitHub repo

### Layout (`templates/layout.eta`)

Shared shell for both page types:
- `<head>`: charset, viewport meta, linked `style.css`, `<title>` as `{siteTitle} | {pageTitle}`
- Nav bar: site title (links to index), list of repos with releases (links to repo pages)
- Footer: "Generated at {timestamp}" + link to the change-blogger GitHub repo
- Body slot for page-specific content

## Styling

Custom `style.css` with no external framework:
- Dark-on-light color scheme, clean typography
- Card-based layout for release entries
- Semantic CSS classes: `.release-card`, `.time-bucket`, `.repo-nav`, `.repo-badge`
- Author avatars as small circles
- Code blocks in rendered markdown get syntax-highlighted background colors via CSS
- Responsive: single breakpoint for mobile/desktop
- Accent color for links, repo badges, and section headers

## Navigation

- Nav bar lists all repos that have at least one release, each linking to its repo page
- On the index page, each release card's repo name links to that repo's page
- Repo pages link back to the index via the site title in the nav

## Config

No new config fields. Phase 2 uses existing fields:
- `outputDir` — destination for generated HTML (default: `"site"`)
- `siteTitle` — displayed in nav and `<title>` tag
- `siteUrl` — used for canonical/absolute links (primarily useful in Phase 3 for RSS)

## npm Scripts

- `generate`: changes from placeholder echo to `node dist/generate.js`
- `build:site` (new): convenience script that runs `npm run build && npm run fetch && npm run generate`

## Error Handling

- Missing `data/releases.json`: `generate.ts` exits with a clear error message instructing the user to run `npm run fetch` first.
- Malformed markdown in release bodies: `marked` renders what it can; no crash.
- Empty repos (no releases): excluded from nav and no repo page generated.

## Dependencies (new)

| Package | Purpose | Size |
|---------|---------|------|
| `eta` | Template engine | ~3KB |
| `marked` | Markdown to HTML | ~40KB |

## Out of Scope

- Second audience theme (architecture supports it, not built in Phase 2)
- RSS/Atom feeds (Phase 3)
- GitHub Actions automation (Phase 4)
- Client-side Google OAuth gate (Phase 5)
- Syntax highlighting via a JS library (CSS-only code block styling for now)
