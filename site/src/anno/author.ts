import { anchorFromSelection } from "../web3/selection";
import { nearestContainer, selectorFor } from "./selector";
import { canonicalizeUrl } from "./canonicalUrl";
import type { AnnoFields } from "./schema";

const ZERO_UID = "0x" + "00".repeat(32);

export interface DraftInput {
  /** The page URL at authoring time (e.g. location.href). */
  href: string;
  /** The page language (e.g. document.documentElement.lang). */
  lang: string;
  /** The user's text selection. */
  range: Range;
  /** The comment body. */
  body: string;
  /** Parent attestation UID for a reply (default: zero = top-level). */
  parentUid?: string;
  /** JSON escape-hatch (default: ""). */
  meta?: string;
}

/**
 * Build a complete `AnnoFields` from a selection: resolve the stable container,
 * generate its selector, anchor the quote within it, and canonicalize the URL.
 * Returns null when the selection has no usable container/anchor.
 */
export function buildAnnoFields(input: DraftInput): AnnoFields | null {
  const container = nearestContainer(input.range.commonAncestorContainer);
  if (container === null) return null;
  const anchor = anchorFromSelection(container, input.range);
  if (anchor === null) return null;
  const { url, urlCanonical, origin } = canonicalizeUrl(input.href);
  return {
    url,
    urlCanonical,
    origin,
    lang: input.lang,
    rootSelector: selectorFor(container),
    containerHash: anchor.blockHash,
    spanStart: anchor.start,
    spanEnd: anchor.end,
    spanExact: anchor.exact,
    spanPrefix: anchor.prefix,
    spanSuffix: anchor.suffix,
    parentUid: input.parentUid ?? ZERO_UID,
    body: input.body,
    meta: input.meta ?? "",
  };
}
