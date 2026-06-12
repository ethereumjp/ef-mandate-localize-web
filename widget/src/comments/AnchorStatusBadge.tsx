import type { AnchorStatus } from "@commentary/core/lib/anchoring";
import { ct } from "./i18n";

export function AnchorStatusBadge({ status, lang }: { status: AnchorStatus; lang: string }) {
  if (status === "anchored") return null;
  const label =
    status === "re-anchored"
      ? ct(lang, "statusReanchored")
      : status === "needs-review"
        ? ct(lang, "statusNeedsReview")
        : ct(lang, "statusOrphaned");
  const tone =
    status === "orphaned"
      ? "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{label}</span>;
}
