import type { AnchorStatus } from "@commentary/core/lib/anchoring";
import { MESSAGES, type Lang } from "../../lib/i18n";

export function AnchorStatusBadge({ status, lang }: { status: AnchorStatus; lang: Lang }) {
  if (status === "anchored") return null;
  const m = MESSAGES[lang];
  const label =
    status === "re-anchored"
      ? m.statusReanchored
      : status === "needs-review"
        ? m.statusNeedsReview
        : m.statusOrphaned;
  const tone =
    status === "orphaned"
      ? "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{label}</span>;
}
