import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { keccak256, stringToBytes } from "viem";

export interface SourceConfig {
  lang: string;
  /** Human identifier, e.g. "ethereumjp/ef-mandate-localize-jp@ja". */
  sourceId: string;
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

/** On-chain sourceId = keccak256(identifier). */
export function sourceIdHash(identifier: string): `0x${string}` {
  return keccak256(stringToBytes(identifier));
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
