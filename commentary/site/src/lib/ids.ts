export const ID_RE = /^(\d{2})-p(\d+)$/;

export function formatId(chapter: string, n: number): string {
  return `${chapter}-p${n}`;
}

export function parseIdNumber(id: string): number | null {
  const m = ID_RE.exec(id);
  return m ? parseInt(m[2], 10) : null;
}

/** Smallest unused number = max existing + 1 (stable; never renumbers). */
export function nextIdNumber(existing: string[]): number {
  let max = 0;
  for (const id of existing) {
    const n = parseIdNumber(id);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}
