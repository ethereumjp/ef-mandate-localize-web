import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { wagmiConfig, ANNO_SCHEMA_UID } from "../../web3/config";
import { useEthersSigner } from "../../web3/ethers";
import { anchorFromSelection } from "../../web3/selection";
// Static imports of the EAS attest path. Safe because Document.astro mounts
// this island with client:only="react", so it is never SSR-rendered and the
// EAS SDK (lodash ESM re-export) never enters the SSR module graph. Vite
// bundles encodeAnno/attestComment into the client chunk this way; the old
// dynamic import() was elided from the static build, killing on-chain publish.
import { encodeAnno, type AnnoFields } from "../../anno/schema";
import { attestComment } from "../../web3/eas";
import { fetchAnno } from "../../anno/read";
import { projectAnno, type StoredAnno, type LocatedAnno } from "../../anno/locate";
import { canonicalizeUrl } from "../../anno/canonicalUrl";
import { rangeForOffsets, applyHighlights } from "../../web3/highlight";
import { buildMockAnno } from "../../anno/mock";
import type { Lang } from "../../lib/i18n";
import { ConnectButton } from "./ConnectButton";
import { SelectionPopover } from "./SelectionPopover";
import { Composer } from "./Composer";
import { CommentThread } from "./CommentThread";

const queryClient = new QueryClient();
const ZERO_UID = "0x" + "00".repeat(32);
// Stable empty default so `stored` keeps a constant reference while the query is
// disabled/loading — otherwise `[]` is a new array each render, `merged` recomputes,
// and the projection effect (dep on `merged`) loops "Maximum update depth exceeded".
const EMPTY_COMMENTS: StoredAnno[] = [];
// Dev-only: PUBLIC_MOCK_COMMENTS=1 (`pnpm run dev:mock`) renders DOM-derived mock
// comments so the UI can be tuned with no on-chain data.
const MOCK = import.meta.env.PUBLIC_MOCK_COMMENTS === "1";

interface Props {
  lang: Lang;
}

interface SelectionTarget {
  blockEl: Element;
  blockId: string;
  anchor: import("../../lib/anchoring").Anchor;
  rect: DOMRect;
}

/** Read whether commentary is currently toggled on (driven by scripts/toggles.ts). */
function commentsEnabled(): boolean {
  return document.documentElement.dataset.comments === "on";
}

/** The caret (node, offset) under a viewport point — used to hit-test span clicks. */
function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

function CommentController({ lang }: Props) {
  const signer = useEthersSigner();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const qc = useQueryClient();

  const [walletSlot, setWalletSlot] = useState<Element | null>(null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const [composerFields, setComposerFields] = useState<Omit<AnnoFields, "body"> | null>(null);
  const [commentsOn, setCommentsOn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusedUid, setFocusedUid] = useState<string | null>(null);

  // Optimistic comments live as full StoredAnnos; `pending` tracks the temp-uids
  // that are still unconfirmed so one list + one renderer handles both.
  const [optimistic, setOptimistic] = useState<StoredAnno[]>([]);
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // Projection state: a per-block map (for span lookup / hit-testing) plus the flat,
  // document-ordered list the sidebar renders.
  const projectedByBlock = useRef<Map<string, LocatedAnno[]>>(new Map());
  const [projected, setProjected] = useState<LocatedAnno[]>([]);

  // Capture the selection target when opening the composer, so it is stable
  // even after the DOM selection is cleared.
  const capturedTarget = useRef<SelectionTarget | null>(null);

  // Confirmed comments for the schema (refetched after a successful attest). In
  // mock mode (`pnpm run dev:mock`) we skip the chain and synthesize comments from
  // the live DOM so the comment UI can be tuned with no on-chain data.
  const { data: queried = EMPTY_COMMENTS } = useQuery({
    queryKey: ["comments", ANNO_SCHEMA_UID],
    queryFn: () => fetchAnno(ANNO_SCHEMA_UID),
    enabled: !MOCK && !!ANNO_SCHEMA_UID,
    staleTime: 15000,
  });
  const [mockData, setMockData] = useState<StoredAnno[]>(EMPTY_COMMENTS);
  useEffect(() => {
    if (!MOCK) return;
    setMockData(buildMockAnno(lang));
    document.documentElement.dataset.comments = "on"; // reveal them immediately
  }, [lang]);
  const stored = MOCK ? mockData : queried;

  // Merge stored + optimistic, deduped by uid (confirmed wins over its temp dupe).
  const merged = useMemo(() => {
    const storedUids = new Set(stored.map((c) => c.uid));
    return [...stored, ...optimistic.filter((o) => !storedUids.has(o.uid))];
  }, [stored, optimistic]);

  // Resolve #wallet-slot after mount (it exists in the static DOM at client:load).
  useEffect(() => {
    const el = document.getElementById("wallet-slot");
    if (el) setWalletSlot(el);
  }, []);

  // Track the comments on/off state (toggles.ts flips data-comments on <html>).
  useEffect(() => {
    setCommentsOn(commentsEnabled());
    const obs = new MutationObserver(() => setCommentsOn(commentsEnabled()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-comments"],
    });
    return () => obs.disconnect();
  }, []);

  // Comments on → reveal the sidebar; off → hide it and drop any focus.
  useEffect(() => {
    if (commentsOn) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
      setFocusedUid(null);
      applyHighlights("comment-focus", []);
    }
  }, [commentsOn]);

  // selectionchange → popover. Authoring is independent of the comments toggle
  // (the toggle only gates display of already-registered comments).
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // Walk up from the common ancestor to find a [data-block-id] element.
      let node: Node | null = range.commonAncestorContainer;
      let blockEl: Element | null = null;
      while (node) {
        if (node instanceof Element && node.hasAttribute("data-block-id")) {
          blockEl = node;
          break;
        }
        node = node.parentNode;
      }
      if (!blockEl) {
        setSelection(null);
        return;
      }
      const blockId = blockEl.getAttribute("data-block-id") ?? "";
      const anchor = anchorFromSelection(blockEl, range);
      if (!anchor) {
        setSelection(null);
        return;
      }
      const rawRect = range.getBoundingClientRect();
      // Clamp the popover so it isn't off-screen (M4-7 minor fix).
      const rect = new DOMRect(
        rawRect.left,
        Math.max(8, rawRect.top - 36),
        rawRect.width,
        rawRect.height,
      );
      setSelection({ blockEl, blockId, anchor, rect });
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Project the (lang-filtered) comments per block, paint the underline markers,
  // and publish the flat document-ordered list the sidebar renders.
  useEffect(() => {
    const byBlock = projectedByBlock.current;
    byBlock.clear();

    if (!commentsOn) {
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      setProjected([]);
      return;
    }

    // Filter to this page's language, then group by rootSelector (= the block).
    const groups = new Map<string, StoredAnno[]>();
    for (const c of merged) {
      if (c.lang !== lang) continue;
      const arr = groups.get(c.rootSelector) ?? [];
      arr.push(c);
      groups.set(c.rootSelector, arr);
    }

    const resolved: { top: number; items: LocatedAnno[] }[] = [];
    const ranges: Range[] = [];
    for (const [rootSelector, group] of groups) {
      const blockEl = document.querySelector(rootSelector);
      if (!blockEl) continue;
      const items = projectAnno(blockEl, group);
      byBlock.set(rootSelector, items);
      resolved.push({ top: blockEl.getBoundingClientRect().top + window.scrollY, items });
      for (const p of items) {
        const s = p.projection.status;
        if (s !== "anchored" && s !== "re-anchored") continue;
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r) ranges.push(r);
      }
    }

    applyHighlights("comment", ranges);
    resolved.sort((a, b) => a.top - b.top);
    setProjected(resolved.flatMap((r) => r.items));
  }, [merged, lang, commentsOn]);

  // Focus a comment: open the sidebar, wash its span, scroll the span into view.
  const focusComment = useCallback((uid: string) => {
    setFocusedUid(uid);
    setSidebarOpen(true);
    for (const [rootSelector, group] of projectedByBlock.current) {
      const p = group.find((x) => x.comment.uid === uid);
      if (!p) continue;
      const blockEl = document.querySelector(rootSelector);
      if (!blockEl || p.projection.start === null || p.projection.end === null) return;
      const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
      if (r) {
        applyHighlights("comment-focus", [r]);
        blockEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }
  }, []);

  // Click an underlined span → focus its card (hit-test the click point against
  // each anchored comment's range).
  useEffect(() => {
    if (!commentsOn) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Element | null;
      if (t && t.closest("aside, [role='dialog'], header, #wallet-slot")) return;
      const pos = caretFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      for (const [rootSelector, group] of projectedByBlock.current) {
        const blockEl = document.querySelector(rootSelector);
        if (!blockEl || !blockEl.contains(pos.node)) continue;
        for (const p of group) {
          if (p.projection.start === null || p.projection.end === null) continue;
          const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
          if (r && r.comparePoint(pos.node, pos.offset) === 0) {
            focusComment(p.comment.uid);
            return;
          }
        }
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [commentsOn, focusComment]);

  // Build the anno fields for the captured selection. Shared by the composer
  // preview and the actual attestation, so the preview matches what's recorded.
  function annoFieldsFromTarget(target: SelectionTarget): Omit<AnnoFields, "body"> {
    const { anchor, blockId } = target;
    const { url, urlCanonical, origin } = canonicalizeUrl(location.href);
    return {
      url,
      urlCanonical,
      origin,
      lang,
      rootSelector: `[data-block-id="${blockId}"]`,
      containerHash: anchor.blockHash,
      spanStart: anchor.start,
      spanEnd: anchor.end,
      spanExact: anchor.exact,
      spanPrefix: anchor.prefix,
      spanSuffix: anchor.suffix,
      parentUid: ZERO_UID,
      meta: "",
    };
  }

  function openComposer() {
    capturedTarget.current = selection;
    setComposerError(null);
    setComposerFields(selection ? annoFieldsFromTarget(selection) : null);
    setComposerOpen(true);
  }

  async function handleSubmit(body: string) {
    const target = capturedTarget.current;
    if (!target) return;

    if (!signer || !ANNO_SCHEMA_UID) {
      setComposerError("Connect a wallet on Sepolia (and set PUBLIC_EAS_ANNO_SCHEMA_UID).");
      return;
    }

    const fields: AnnoFields = { ...annoFieldsFromTarget(target), body };

    const tempUid = `opt-${Date.now()}`;
    const optimisticComment: StoredAnno = {
      ...fields,
      uid: tempUid,
      attester: address ?? "you",
      time: 0,
    };

    setOptimistic((prev) => [...prev, optimisticComment]);
    setPending((prev) => new Set(prev).add(tempUid));
    setComposerOpen(false);
    setComposerPending(true);

    try {
      const uid = await attestComment(signer, ANNO_SCHEMA_UID, encodeAnno(fields));
      // Swap the temp-uid → the real returned uid, then refetch so the confirmed
      // attestation arrives from EAS and the optimistic dupe collapses by uid.
      setOptimistic((prev) => prev.map((c) => (c.uid === tempUid ? { ...c, uid } : c)));
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(tempUid);
        return next;
      });
      qc.invalidateQueries({ queryKey: ["comments", ANNO_SCHEMA_UID] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOptimistic((prev) => prev.filter((c) => c.uid !== tempUid));
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(tempUid);
        return next;
      });
      setComposerError(msg);
      setComposerOpen(true);
    } finally {
      setComposerPending(false);
    }
  }

  return (
    <>
      {walletSlot ? createPortal(<ConnectButton />, walletSlot) : null}
      {selection && !composerOpen ? (
        <SelectionPopover rect={selection.rect} onClick={openComposer} />
      ) : null}
      <Composer
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) setComposerError(null);
        }}
        onSubmit={handleSubmit}
        pending={composerPending}
        error={composerError}
        connected={isConnected}
        onConnect={() => connect({ connector: injected() })}
        fieldsPreview={composerFields}
        schemaUid={ANNO_SCHEMA_UID}
      />
      {commentsOn && sidebarOpen ? (
        <CommentThread
          comments={projected}
          lang={lang}
          focusedUid={focusedUid}
          pendingUids={pending}
          onFocus={focusComment}
          onClose={() => {
            setSidebarOpen(false);
            setFocusedUid(null);
            applyHighlights("comment-focus", []);
          }}
        />
      ) : null}
    </>
  );
}

export default function CommentApp({ lang }: Props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CommentController lang={lang} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
