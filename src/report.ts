import { resolve } from "node:path";
import { getConfig } from "./config.js";
import { generateReport, generateMarkdownReport } from "./generate.js";
import { createGithubUserFetcher } from "./users.js";

async function main(): Promise<void> {
  const config = getConfig();
  const projectRoot = process.cwd();

  const dataPath = resolve(projectRoot, "data", "releases.json");
  const outputDir = resolve(projectRoot, config.outputDir);

  await generateReport({
    dataPath,
    outputDir,
    templatesDir: resolve(projectRoot, "templates"),
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
    usersPath: resolve(projectRoot, "data", "users.json"),
    userFetcher: createGithubUserFetcher(config.githubToken),
  });

  await generateMarkdownReport({
    dataPath,
    outputDir,
    siteTitle: config.siteTitle,
  });
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
