import { readFileSync } from "node:fs";
import { loadConfig, listChapters, chaptersDir } from "../src/lib/sources";
import { parseChapter } from "../src/lib/blocks";
import { missingOrDuplicateIds, parityIssues, CheckIssue } from "../src/lib/check";

const configPath = process.argv[2] ?? "config.json";
const { config, baseDir } = loadConfig(configPath);
const en = config.sources.find((s) => s.lang === "en");
if (!en) throw new Error("config must include an 'en' source");

const issues: CheckIssue[] = [];
const pending: string[] = [];
const enIdsByChapter = new Map<string, string[]>();

// English is the authority: every EN block must be uniquely marked.
for (const [chapter, file] of listChapters(chaptersDir(baseDir, en))) {
  const blocks = parseChapter(readFileSync(file, "utf8"));
  issues.push(...missingOrDuplicateIds(blocks, "en", chapter));
  enIdsByChapter.set(chapter, blocks.map((b) => b.id ?? ""));
}

// Translations: enforce parity only on chapters whose block count matches EN
// (translated + aligned). In-progress chapters are reported as pending, not failed.
for (const src of config.sources.filter((s) => s.lang !== "en")) {
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    const enIds = enIdsByChapter.get(chapter);
    if (!enIds) continue;
    const blocks = parseChapter(readFileSync(file, "utf8"));
    if (blocks.length !== enIds.length) {
      pending.push(`${src.lang} ${chapter} (${blocks.length}/${enIds.length})`);
      continue;
    }
    issues.push(...missingOrDuplicateIds(blocks, src.lang, chapter));
    issues.push(...parityIssues(enIds, blocks.map((b) => b.id ?? ""), src.lang, chapter));
  }
}

if (pending.length > 0) {
  console.log(`ℹ pending translation (skipped): ${pending.join(", ")}`);
}
if (issues.length > 0) {
  for (const i of issues) console.error(`✗ ${i.lang} ${i.chapter} [${i.kind}] ${i.detail}`);
  console.error(`\n${issues.length} issue(s). Run: pnpm run blocks:inject`);
  process.exit(1);
}
console.log("✓ all block markers valid and aligned");
