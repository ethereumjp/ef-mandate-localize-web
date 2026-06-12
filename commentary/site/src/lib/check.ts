import { Block } from "./blocks";

export interface CheckIssue {
  lang: string;
  chapter: string;
  kind: "missing-marker" | "duplicate-id" | "missing-in-translation" | "extra-in-translation";
  detail: string;
}

export function missingOrDuplicateIds(
  blocks: Block[],
  lang: string,
  chapter: string,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const seen = new Set<string>();
  blocks.forEach((b, i) => {
    if (b.id === null) {
      issues.push({ lang, chapter, kind: "missing-marker", detail: `block #${i}` });
    } else if (seen.has(b.id)) {
      issues.push({ lang, chapter, kind: "duplicate-id", detail: b.id });
    } else {
      seen.add(b.id);
    }
  });
  return issues;
}

export function parityIssues(
  enIds: string[],
  langIds: string[],
  lang: string,
  chapter: string,
): CheckIssue[] {
  const en = new Set(enIds);
  const lg = new Set(langIds);
  const issues: CheckIssue[] = [];
  for (const id of en) {
    if (!lg.has(id)) issues.push({ lang, chapter, kind: "missing-in-translation", detail: id });
  }
  for (const id of lg) {
    if (!en.has(id)) issues.push({ lang, chapter, kind: "extra-in-translation", detail: id });
  }
  return issues;
}
