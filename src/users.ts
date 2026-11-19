import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ── User cache ───────────────────────────────────────────────────────────────
//
// Disk-backed cache of GitHub user profile data (login, display name, avatar,
// profile URL) so repeat report builds never re-request users from GitHub.
// Mirrors the data/releases.json read/write pattern in src/fetch.ts.

export interface CachedUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  /** true when GitHub reported the user missing (negative cache) */
  missing?: boolean;
  /** set once the profile (display name) has been fetched from the API */
  fetchedAt?: string;
}

export interface UserData {
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

/**
 * Fetches one user's profile. Returns:
 *  - UserData on success
 *  - null when the user does not exist (negative-cached)
 *  - undefined on transient failure (rate limit, network) — not cached
 */
export type UserFetcher = (login: string) => Promise<UserData | null | undefined>;

export interface UserCacheOptions {
  cachePath: string;
  fetcher?: UserFetcher;
}

export interface UserCache {
  /** Resolve a login, fetching (once) and persisting if not cached. */
  resolve(login: string): Promise<CachedUser | null>;
  /** Synchronous lookup of already-loaded/resolved entries. */
  getSync(login: string): CachedUser | null;
  /** Seed login/avatar/profile data already in hand (e.g. release authors). */
  seed(user: { login: string; avatarUrl?: string; htmlUrl?: string }): void;
  /** Persist the cache to disk. */
  save(): void;
}

function defaultAvatarUrl(login: string): string {
  return `https://github.com/${login}.png`;
}

function defaultHtmlUrl(login: string): string {
  return `https://github.com/${login}`;
}

export function createUserCache(options: UserCacheOptions): UserCache {
  const { cachePath, fetcher } = options;
  const entries = new Map<string, CachedUser>();

  if (existsSync(cachePath)) {
    try {
      const raw = JSON.parse(readFileSync(cachePath, "utf-8")) as Record<
        string,
        CachedUser
      >;
      for (const [login, entry] of Object.entries(raw)) {
        if (entry && typeof entry.login === "string") {
          entries.set(login.toLowerCase(), entry);
        }
      }
    } catch {
      // Corrupt cache file: start fresh rather than failing the build.
    }
  }

  function save(): void {
    const out: Record<string, CachedUser> = {};
    for (const entry of entries.values()) {
      out[entry.login] = entry;
    }
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(out, null, 2));
  }

  return {
    getSync(login: string): CachedUser | null {
      return entries.get(login.toLowerCase()) ?? null;
    },

    seed(user: { login: string; avatarUrl?: string; htmlUrl?: string }): void {
      const key = user.login.toLowerCase();
      if (entries.has(key)) return;
      entries.set(key, {
        login: user.login,
        name: null,
        avatarUrl: user.avatarUrl || defaultAvatarUrl(user.login),
        htmlUrl: user.htmlUrl || defaultHtmlUrl(user.login),
      });
    },

    async resolve(login: string): Promise<CachedUser | null> {
      const key = login.toLowerCase();
      const existing = entries.get(key);

      // Fully fetched (or negative-cached) entries never re-request.
      if (existing?.fetchedAt) return existing;
      if (!fetcher) return existing ?? null;

      let data: UserData | null | undefined;
      try {
        data = await fetcher(login);
      } catch {
        data = undefined;
      }

      // Transient failure: fall back to whatever we have, don't cache the miss.
      if (data === undefined) return existing ?? null;

      const entry: CachedUser =
        data === null
          ? {
              login,
              name: null,
              avatarUrl: existing?.avatarUrl || defaultAvatarUrl(login),
              htmlUrl: existing?.htmlUrl || defaultHtmlUrl(login),
              missing: true,
              fetchedAt: new Date().toISOString(),
            }
          : {
              login,
              name: data.name ?? null,
              avatarUrl:
                data.avatarUrl || existing?.avatarUrl || defaultAvatarUrl(login),
              htmlUrl: data.htmlUrl || existing?.htmlUrl || defaultHtmlUrl(login),
              fetchedAt: new Date().toISOString(),
            };

      entries.set(key, entry);
      save();
      return entry;
    },

    save,
  };
}

// ── Real GitHub fetcher ──────────────────────────────────────────────────────

export function createGithubUserFetcher(token?: string): UserFetcher {
  return async (login: string) => {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "change-blogger",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(login)}`,
      { headers }
    );
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) return undefined; // rate limit / transient — never fail the build
    const data = (await res.json()) as {
      name?: string | null;
      avatar_url?: string;
      html_url?: string;
    };
    return {
      name: data.name ?? null,
      avatarUrl: data.avatar_url || defaultAvatarUrl(login),
      htmlUrl: data.html_url || defaultHtmlUrl(login),
    };
  };
}
