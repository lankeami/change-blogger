---
name: daily-report
description: One-shot build of the org-wide changelog home page. Fetches fresh GitHub release data, generates both the HTML report and a markdown table (releases.md), and opens the report in the browser. No server started.
---

# Daily Report

Generate the org-wide changelog and open it directly in the browser. One-shot — no server left running.

## Starting State

- Project root: `/Users/jaychinthrajah/workspaces/change-blogger`
- `.env` contains `GITHUB_TOKEN`
- TypeScript source, templates, and config are in place

## Steps

1. Run the build pipeline from the project root:

```bash
make report
```

This compiles TypeScript, fetches fresh release data from the GitHub API, generates both the HTML report (`site/report.html`) and a markdown table (`site/releases.md`), and opens `site/report.html` in the default browser.

2. If `make report` fails, run the steps individually to isolate the issue:

```bash
make build     # Compile TypeScript
make fetch     # Fetch releases from GitHub API
make generate  # Render templates to site/
open site/index.html
```

3. Report: how many repos were fetched, whether any errors occurred, and the file path opened.

## Target State

`site/report.html` is open in the default browser showing the org-wide release timeline. `site/releases.md` contains the same release data as a markdown table (with Repo, Tag, Release Name, Date, Author columns, grouped by time bucket, and `<details>` blocks for release bodies) suitable for discussion with Claude or other LLMs.

## Constraints

- MUST NOT start or leave a web server running (`make serve`, `python3 -m http.server`, etc.)
- MUST NOT modify source files, templates, or config
- MUST NOT install dependencies or change `package.json`
- If the build fails due to a missing token or network error, report the error clearly — do not retry or attempt to fix config

## Done When

`site/report.html` is opened in the browser, `site/releases.md` exists alongside it, and you have reported the result. Nothing else.
