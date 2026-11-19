import { marked } from "marked";
import { Eta } from "eta";
import type { AtomFeed } from "./feed.js";

// ── Date helpers ─────────────────────────────────────────────────────────────

export type TimeBucket = "this-week" | "last-week" | "older";

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getTimeBucket(publishedAt: string, now?: Date): TimeBucket {
  const ref = now ?? new Date();
  const published = new Date(publishedAt);

  const thisWeekStart = getISOWeekStart(ref);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  if (published >= thisWeekStart) return "this-week";
  if (published >= lastWeekStart) return "last-week";
  return "older";
}

export function getRelativeDate(publishedAt: string, now?: Date): string {
  const ref = now ?? new Date();
  const published = new Date(publishedAt);
  const diffMs = ref.getTime() - published.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return published.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── HTML escaping ────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Markdown renderer ────────────────────────────────────────────────────────

// Add new-tab attributes to absolute http(s) links in rendered HTML.
// Relative and hash links are left alone.
export function addExternalLinkAttrs(html: string): string {
  return html.replace(
    /<a\s([^>]*href="https?:\/\/[^"]*"[^>]*)>/gi,
    (match, attrs: string) => {
      if (/\btarget=/i.test(attrs)) return match;
      return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
    }
  );
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";
  return addExternalLinkAttrs(marked.parse(markdown) as string);
}

// ── User pills (issue #20) ───────────────────────────────────────────────────

export interface PillUser {
  login: string;
  name?: string | null;
  avatarUrl?: string;
  htmlUrl?: string;
}

export type ResolveUser = (login: string) => PillUser | null | undefined;

export function renderUserPill(user: PillUser): string {
  const login = user.login;
  const name = user.name ?? null;
  const avatarUrl = user.avatarUrl || `https://github.com/${login}.png?size=32`;
  const htmlUrl = user.htmlUrl || `https://github.com/${login}`;
  const display = name || login;
  const nameAttr = name ? ` data-name="${escapeHtml(name)}"` : "";

  return (
    `<a class="user-pill" href="${escapeHtml(htmlUrl)}"` +
    ` target="_blank" rel="noopener noreferrer"` +
    ` data-login="${escapeHtml(login)}"${nameAttr}>` +
    `<img class="user-pill-avatar" src="${escapeHtml(avatarUrl)}" alt=""` +
    ` width="16" height="16" loading="lazy">` +
    `<span class="user-pill-text">${escapeHtml(display)}</span>` +
    `</a>`
  );
}

// GitHub logins: alphanumeric + internal hyphens, no leading/trailing hyphen,
// max 39 chars. The lookbehind rejects emails (user@domain) and @@.
const MENTION_RE =
  /(?<![A-Za-z0-9_.@/-])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?![A-Za-z0-9-])/g;

const SKIP_TAGS = new Set(["a", "code", "pre", "script", "style"]);

// Walk rendered HTML, applying `onText` only to text outside <a>/<code>/<pre>.
function walkHtmlText(html: string, onText: (text: string) => string): string {
  let result = "";
  let skipDepth = 0;
  const tagRe = /<[^>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html))) {
    const text = html.slice(last, m.index);
    result += skipDepth > 0 ? text : onText(text);

    const tag = m[0];
    const tagName = tag.match(/^<\/?([a-zA-Z0-9]+)/)?.[1]?.toLowerCase();
    if (tagName && SKIP_TAGS.has(tagName)) {
      if (tag.startsWith("</")) skipDepth = Math.max(0, skipDepth - 1);
      else if (!tag.endsWith("/>")) skipDepth++;
    }
    result += tag;
    last = tagRe.lastIndex;
  }

  const tail = html.slice(last);
  result += skipDepth > 0 ? tail : onText(tail);
  return result;
}

// Replace @login mentions in rendered HTML with user pills, skipping code
// blocks, code spans, and existing links.
export function linkifyMentions(html: string, resolveUser: ResolveUser): string {
  if (!html) return html;
  return walkHtmlText(html, (text) =>
    text.replace(MENTION_RE, (_match, login: string) => {
      const user = resolveUser(login) ?? { login };
      return renderUserPill(user);
    })
  );
}

// Collect the mention logins that linkifyMentions would transform.
export function extractMentionLogins(html: string): string[] {
  const logins = new Set<string>();
  if (!html) return [];
  walkHtmlText(html, (text) => {
    for (const m of text.matchAll(MENTION_RE)) {
      logins.add(m[1]);
    }
    return text;
  });
  return [...logins];
}

// ── Template renderer ────────────────────────────────────────────────────────

export interface Renderer {
  renderPage(template: string, data: Record<string, unknown>): string;
  renderStandalone(template: string, data: Record<string, unknown>): string;
  renderFeed(feedData: AtomFeed): string;
}

export function createRenderer(templatesDir: string): Renderer {
  const eta = new Eta({ views: templatesDir, autoEscape: true });

  return {
    renderPage(template: string, data: Record<string, unknown>): string {
      const body = eta.render(`./${template}`, data) as string;
      return eta.render("./layout", { ...data, body }) as string;
    },
    renderStandalone(template: string, data: Record<string, unknown>): string {
      return eta.render(`./${template}`, data) as string;
    },
    renderFeed(feedData: AtomFeed): string {
      return eta.render("./feed", feedData) as string;
    },
  };
}
