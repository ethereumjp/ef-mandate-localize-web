import { Block } from "./blocks";
import { formatId, nextIdNumber } from "./ids";

function withMarker(id: string, content: string): Block {
  return { id, marker: `<!-- block: ${id} -->`, content };
}

/** EN is the authority: keep existing ids, assign new ones as max+1. */
export function assignEnIds(blocks: Block[], chapter: string): Block[] {
  const existing = blocks.map((b) => b.id).filter((x): x is string => x !== null);
  let counter = nextIdNumber(existing);
  return blocks.map((b) => withMarker(b.id ?? formatId(chapter, counter++), b.content));
}

/** Translations mirror EN ids by position. */
export function alignTranslationIds(blocks: Block[], enIds: string[], chapter: string): Block[] {
  if (blocks.length !== enIds.length) {
    throw new Error(
      `chapter ${chapter}: translation has ${blocks.length} blocks but EN has ${enIds.length}; ` +
        `block counts must match to align markers`,
    );
  }
  return blocks.map((b, i) => withMarker(enIds[i], b.content));
}

/** Serialize blocks back to Markdown (marker line + content, blank-separated). */
export function renderChapter(blocks: Block[]): string {
  return blocks.map((b) => `${b.marker}\n${b.content}`).join("\n\n") + "\n";
}
