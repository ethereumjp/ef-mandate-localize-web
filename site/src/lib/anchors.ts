import { parseChapter } from "./blocks";
import { normalizeBlockText } from "@commentary/core/lib/normalize";
import { blockHashFromNormalized } from "@commentary/core/lib/hash";

export interface AnchorEntry {
  blockId: string;
  order: number;
  text: string;
  blockHash: `0x${string}`;
}

/** blockId -> entry, in document order. */
export type ChapterAnchors = Record<string, AnchorEntry>;

export function buildChapterAnchors(source: string): ChapterAnchors {
  const out: ChapterAnchors = {};
  parseChapter(source).forEach((b, i) => {
    if (b.id === null) {
      throw new Error(`block #${i} has no id (run blocks:inject before anchors:build)`);
    }
    const text = normalizeBlockText(b.content);
    out[b.id] = { blockId: b.id, order: i, text, blockHash: blockHashFromNormalized(text) };
  });
  return out;
}
