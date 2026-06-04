# change-blogger

Static changelog website that aggregates GitHub release notes across all repositories in a GitHub organization.

## Setup

### 1. Create a GitHub Token

You need a GitHub personal access token with read access to your org's repositories.

**Fine-grained token (recommended):**
- Go to GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens
- Set Resource owner to your organization
- Repository access: All repositories (or select specific ones)
- Permissions:
  - **Contents**: Read-only
  - **Metadata**: Read-only

**Classic token:**
- Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
- Select the `repo` scope (or `public_repo` for public repos only)

### 2. Configure

```sh
cp config.example.json config.json
```

Edit `config.json` and add your token:

```json
{
  "org": "your-org",
  "githubToken": "ghp_...",
  "outputDir": "site",
  "siteTitle": "Changelog",
  "siteUrl": "https://your-org.github.io/change-blogger",
  "excludeRepos": [],
  "includeDraftReleases": false
}
```

Alternatively, set the `GITHUB_TOKEN` environment variable and omit `githubToken` from the config.

### 3. Install & Build

```sh
npm install
npm run build
```

### 4. Fetch Release Data

```sh
npm run fetch
```

This writes release data to `data/releases.json`.

## Config Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `org` | Yes | — | GitHub organization name |
| `githubToken` | No | `$GITHUB_TOKEN` | GitHub personal access token |
| `outputDir` | No | `"site"` | Directory for generated HTML |
| `siteTitle` | No | `"Changelog"` | Site title |
| `siteUrl` | No | `""` | Base URL for the site |
| `excludeRepos` | No | `[]` | Repos to skip |
| `includeDraftReleases` | No | `false` | Include draft releases |

## License

MIT
