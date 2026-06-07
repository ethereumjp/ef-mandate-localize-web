import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, listChapters, chaptersDir, sourceIdHash } from "../src/lib/sources";
import { parseChapter } from "../src/lib/blocks";
import { buildChapterAnchors, ChapterAnchors } from "../src/lib/anchors";

const configPath = process.argv[2] ?? "config.json";
const outDir = resolve(process.argv[3] ?? "anchors");
const { config, baseDir } = loadConfig(configPath);
mkdirSync(outDir, { recursive: true });

for (const src of config.sources) {
  const chapters: Record<string, ChapterAnchors> = {};
  const pending: string[] = [];
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    const source = readFileSync(file, "utf8");
    // Skip chapters that are not fully marked yet (translation in progress).
    if (!parseChapter(source).every((b) => b.id !== null)) {
      pending.push(chapter);
      continue;
    }
    chapters[chapter] = buildChapterAnchors(source);
  }
  const doc = {
    lang: src.lang,
    sourceIdentifier: src.sourceId,
    sourceId: sourceIdHash(src.sourceId),
    chapters,
  };
  const out = resolve(outDir, `${src.lang}.json`);
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  const note = pending.length > 0 ? `, pending: ${pending.join(", ")}` : "";
  console.log(`wrote ${out} (${Object.keys(chapters).length} chapters${note})`);
}
