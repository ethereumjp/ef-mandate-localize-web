// Dev-only mock comments. Enabled by PUBLIC_MOCK_COMMENTS=1 (`pnpm run dev:mock`).
// Synthesized from the LIVE DOM so they genuinely project onto the page — no
// on-chain data needed to tune the comment UI (highlights, gutter badges, thread
// panel, status tags). Never used unless the flag is set.
import { makeAnchor, codePoints, type Anchor } from "../lib/anchoring";
import { blockHash } from "../lib/hash";
import { normalizedBlockText } from "../web3/selection";
import { canonicalizeUrl } from "./canonicalUrl";
import type { StoredAnno } from "./locate";

const ZERO_UID = "0x" + "00".repeat(32);
const STALE_HASH = ("0x" + "ee".repeat(32)) as `0x${string}`;
const MOCK_AUTHOR = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_TIME = 1717000000; // fixed (deterministic) — shown as a date in the card

const rootSelectorFor = (blockId: string) => `[data-block-id="${blockId}"]`;

function comment(
  over: Partial<StoredAnno> & Pick<StoredAnno, "uid" | "rootSelector" | "lang" | "body">,
): StoredAnno {
  const { url, urlCanonical, origin } = canonicalizeUrl(location.href);
  return {
    attester: MOCK_AUTHOR,
    time: MOCK_TIME,
    url,
    urlCanonical,
    origin,
    containerHash: STALE_HASH,
    spanStart: 0,
    spanEnd: 0,
    spanExact: "",
    spanPrefix: "",
    spanSuffix: "",
    parentUid: ZERO_UID,
    meta: "",
    ...over,
  };
}

/** A code-point slice [from, from+span) of the block as a fresh anchor (→ anchored). */
function sliceAnchor(text: string, from: number, span: number): Anchor | null {
  const len = codePoints(text).length;
  // Slide the start left so the full span fits short blocks (else it collapses
  // to a 1-char quote like "。" on the panel).
  const start = Math.max(0, Math.min(from, len - span));
  const end = Math.min(start + span, len);
  if (end <= start) return null;
  return makeAnchor(blockHash(text), text, start, end);
}

/** Spread an Anchor's span fields onto a comment (containerHash = block hash). */
function withAnchor(a: Anchor, hash: string) {
  return {
    containerHash: hash,
    spanStart: a.start,
    spanEnd: a.end,
    spanExact: a.exact,
    spanPrefix: a.prefix,
    spanSuffix: a.suffix,
  };
}

/**
 * Mock comments attached to the first few content blocks on the page. Covers:
 * a thread with a reply (anchored), a re-anchored "past version", and a
 * needs-review comment. Returns [] if the page has no blocks yet.
 */
export function buildMockAnno(lang: string): StoredAnno[] {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-block-id]"));
  // Skip the chapter heading (block 0) when there's enough content to choose from.
  const pick = blocks.length > 4 ? blocks.slice(1) : blocks;
  const out: StoredAnno[] = [];

  const a = pick[0];
  if (a) {
    const sel = rootSelectorFor(a.getAttribute("data-block-id") ?? "");
    const text = normalizedBlockText(a);
    const an1 = sliceAnchor(text, 0, 28);
    if (an1) {
      out.push(
        comment({
          uid: "mock-a1",
          rootSelector: sel,
          lang,
          body: "Strong opening. Is “mandate” the EF’s remit specifically, or Ethereum’s?",
          ...withAnchor(an1, an1.blockHash),
        }),
        comment({
          uid: "mock-a1r",
          parentUid: "mock-a1",
          rootSelector: sel,
          lang,
          body: "The Foundation’s remit — see ch. III “Our Mandate”.",
          ...withAnchor(an1, an1.blockHash),
        }),
      );
    }
    const an2 = sliceAnchor(text, 44, 22);
    if (an2) {
      out.push(
        comment({
          uid: "mock-a2",
          rootSelector: sel,
          lang,
          body: "Localization note: 「mandate」は「使命」と訳すか検討中。",
          ...withAnchor(an2, an2.blockHash),
        }),
      );
    }
  }

  const b = pick[1];
  if (b) {
    const sel = rootSelectorFor(b.getAttribute("data-block-id") ?? "");
    const text = normalizedBlockText(b);
    const an = sliceAnchor(text, 0, 30);
    if (an) {
      // Stale containerHash → re-anchored ("Comment for past version").
      out.push(
        comment({
          uid: "mock-b1",
          rootSelector: sel,
          lang,
          body: "Re-anchored: the source changed since this was written, quote relocated.",
          ...withAnchor(an, STALE_HASH),
        }),
      );
    }
  }

  const c = pick[2];
  if (c) {
    const sel = rootSelectorFor(c.getAttribute("data-block-id") ?? "");
    // Quote no longer present → needs-review (surfaced in the panel, never inline).
    out.push(
      comment({
        uid: "mock-c1",
        rootSelector: sel,
        lang,
        spanExact: "⟪a phrase that no longer exists⟫",
        body: "The text I quoted is gone — flagged for review.",
      }),
    );
  }

  return out;
}
