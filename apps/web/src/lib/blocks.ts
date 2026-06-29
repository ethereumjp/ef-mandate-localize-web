export interface Block {
  /** One blank-line-delimited segment of a chapter's Markdown. */
  content: string;
}

/** Parse a chapter's Markdown into blocks (blank-line delimited). */
export function parseChapter(source: string): Block[] {
  const lf = source.replace(/\r\n?/g, "\n");
  return lf
    .split(/\n[ \t]*\n+/)
    .map((s) => s.replace(/^\n+|\n+$/g, ""))
    .filter((s) => s.trim().length > 0)
    .map((content) => ({ content }));
}
