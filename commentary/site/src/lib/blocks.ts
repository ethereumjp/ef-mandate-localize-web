/** A block marker line, capturing the id (e.g. `02-p7`). */
export const MARKER_RE = /^<!--\s*block:\s*([^\s>]+)\s*-->\s*$/;

export interface Block {
  /** Stable id, or null if the block has no marker yet. */
  id: string | null;
  /** The raw marker line if present, else null. */
  marker: string | null;
  /** Block content WITHOUT the marker line (raw, pre-normalize). */
  content: string;
}

/** Parse a chapter's Markdown into blocks (blank-line delimited). */
export function parseChapter(source: string): Block[] {
  const lf = source.replace(/\r\n?/g, "\n");
  const segments = lf
    .split(/\n[ \t]*\n+/) // one or more blank lines
    .map((s) => s.replace(/^\n+|\n+$/g, ""))
    .filter((s) => s.trim().length > 0);

  return segments.map((seg) => {
    const lines = seg.split("\n");
    const m = MARKER_RE.exec(lines[0]);
    if (m) {
      return { id: m[1], marker: lines[0], content: lines.slice(1).join("\n") };
    }
    return { id: null, marker: null, content: seg };
  });
}
