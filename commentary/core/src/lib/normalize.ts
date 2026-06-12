// Deterministic canonicalization of a block's text, shared by build + browser.

const MARKER_LINE_RE = /^<!--\s*block:\s*[^>]*-->\s*$/;

/** Remove a leading `<!-- block: ... -->` line if present. */
export function stripMarker(blockSource: string): string {
  const lines = blockSource.split("\n");
  if (lines.length > 0 && MARKER_LINE_RE.test(lines[0])) {
    lines.shift();
  }
  return lines.join("\n");
}

/** Canonical text used for hashing and span offsets. */
export function normalizeBlockText(blockSource: string): string {
  let text = stripMarker(blockSource);
  text = text.replace(/\r\n?/g, "\n"); // line endings -> \n
  text = text.normalize("NFC"); // Unicode NFC
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "")) // trailing whitespace per line
    .join("\n");
  return text.trim(); // trim block ends
}

/** Length in Unicode code points (offsets are code-point based). */
export function codePointLength(text: string): number {
  return [...text].length;
}
