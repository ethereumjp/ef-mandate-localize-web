import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface SourceConfig {
  lang: string;
  /** Path to the chapters directory, relative to config.json. */
  path: string;
}

export interface Config {
  sources: SourceConfig[];
}

export function loadConfig(configPath: string): { config: Config; baseDir: string } {
  const abs = resolve(configPath);
  const config = JSON.parse(readFileSync(abs, "utf8")) as Config;
  return { config, baseDir: dirname(abs) };
}

export function chaptersDir(baseDir: string, src: SourceConfig): string {
  return resolve(baseDir, src.path);
}

export function chapterNumberFromFilename(name: string): string | null {
  if (!name.endsWith(".md") || name.startsWith(".")) return null;
  const num = name.slice(0, 2);
  return /^\d{2}$/.test(num) ? num : null;
}

/** Map of chapterNumber -> absolute file path, sorted by chapter number. */
export function listChapters(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of readdirSync(dir).sort()) {
    const num = chapterNumberFromFilename(name);
    if (num) map.set(num, resolve(dir, name));
  }
  return map;
}
