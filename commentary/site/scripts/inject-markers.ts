import { readFileSync, writeFileSync } from "node:fs";
import { loadConfig, listChapters, chaptersDir } from "../src/lib/sources";
import { parseChapter } from "../src/lib/blocks";
import { assignEnIds, alignTranslationIds, renderChapter } from "../src/lib/inject";

const configPath = process.argv[2] ?? "config.json";
const { config, baseDir } = loadConfig(configPath);

const en = config.sources.find((s) => s.lang === "en");
if (!en) throw new Error("config must include an 'en' source (the id authority)");

// 1. English first (the id authority): always inject.
const enIdsByChapter = new Map<string, string[]>();
for (const [chapter, file] of listChapters(chaptersDir(baseDir, en))) {
  const blocks = assignEnIds(parseChapter(readFileSync(file, "utf8")), chapter);
  writeFileSync(file, renderChapter(blocks));
  enIdsByChapter.set(
    chapter,
    blocks.map((b) => b.id as string),
  );
  console.log(`en ${chapter}: ${blocks.length} blocks`);
}

// 2. Translations aligned to EN by position. A chapter whose block count does
//    not yet match EN is treated as "translation in progress": it is left
//    untouched and reported as pending (this localization is ongoing).
for (const src of config.sources.filter((s) => s.lang !== "en")) {
  const pending: string[] = [];
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    const enIds = enIdsByChapter.get(chapter);
    if (!enIds) {
      console.warn(`${src.lang} ${chapter}: no matching EN chapter — skipped`);
      continue;
    }
    const blocks = parseChapter(readFileSync(file, "utf8"));
    if (blocks.length !== enIds.length) {
      pending.push(chapter);
      console.warn(
        `${src.lang} ${chapter}: ${blocks.length}/${enIds.length} blocks — translation incomplete, skipped`,
      );
      continue;
    }
    const aligned = alignTranslationIds(blocks, enIds, chapter);
    writeFileSync(file, renderChapter(aligned));
    console.log(`${src.lang} ${chapter}: ${aligned.length} blocks`);
  }
  if (pending.length > 0) {
    console.log(`${src.lang}: pending translation: ${pending.join(", ")}`);
  }
}
console.log("done");
