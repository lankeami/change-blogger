import { resolve } from "node:path";
import { getConfig } from "./config.js";
import { generateReport } from "./generate.js";

async function main(): Promise<void> {
  const config = getConfig();
  const projectRoot = process.cwd();

  await generateReport({
    dataPath: resolve(projectRoot, "data", "releases.json"),
    outputDir: resolve(projectRoot, config.outputDir),
    templatesDir: resolve(projectRoot, "templates"),
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
  });
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
