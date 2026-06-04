import { marked } from "marked";

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

// ── Markdown renderer ────────────────────────────────────────────────────────

export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";
  return marked.parse(markdown) as string;
}
