import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./types.js";

export function getConfig(): Config {
  const configPath = resolve(process.cwd(), "config.json");

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    throw new Error(
      `Could not read config.json at ${configPath}. Copy config.example.json to config.json and fill in your values.`
    );
  }

  if (!raw.org || typeof raw.org !== "string") {
    throw new Error("config.json: 'org' is required and must be a string");
  }

  const token =
    (raw.githubToken as string | undefined) || process.env.GITHUB_TOKEN;

  return {
    org: raw.org,
    githubToken: token,
    outputDir: (raw.outputDir as string) || "site",
    siteTitle: (raw.siteTitle as string) || "Changelog",
    siteUrl: (raw.siteUrl as string) || "",
    excludeRepos: (raw.excludeRepos as string[]) || [],
    includeDraftReleases: (raw.includeDraftReleases as boolean) ?? false,
  };
}
