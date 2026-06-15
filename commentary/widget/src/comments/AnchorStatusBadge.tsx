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
  // re-anchored is informational (the quote was relocated), so keep it quiet: no
  // box, small dim text. needs-review/orphaned stay boxed since they need action.
  const cls =
    status === "re-anchored"
      ? "text-[10px] text-cobalt/40"
      : status === "orphaned"
        ? "border border-cobalt/30 px-1.5 py-0.5 text-xs text-cobalt/60"
        : "border border-cobalt px-1.5 py-0.5 text-xs text-cobalt";
  return <span className={cls}>{label}</span>;
}
