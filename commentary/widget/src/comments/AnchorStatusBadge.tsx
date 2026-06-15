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
      ? "border border-cobalt/30 text-cobalt/60"
      : "border border-cobalt text-cobalt";
  return <span className={`px-1.5 py-0.5 text-xs ${tone}`}>{label}</span>;
}
