import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { wagmiConfig, SCHEMA_UID } from "../../web3/config";
import { useEthersSigner } from "../../web3/ethers";
import { anchorFromSelection } from "../../web3/selection";
// Static imports of the EAS attest path. Safe because Document.astro mounts
// this island with client:only="react", so it is never SSR-rendered and the
// EAS SDK (lodash ESM re-export) never enters the SSR module graph. Vite
// bundles encodeComment/attestComment into the client chunk this way; the old
// dynamic import() was elided from the static build, killing on-chain publish.
import { encodeComment } from "../../web3/schema";
import { attestComment } from "../../web3/eas";
import { fetchComments, type StoredComment } from "../../web3/read";
import { projectComments, type ProjectedComment } from "../../web3/projectComments";
import { rangeForOffsets, applyHighlights } from "../../web3/highlight";
import type { Lang } from "../../lib/i18n";
import { ConnectButton } from "./ConnectButton";
import { SelectionPopover } from "./SelectionPopover";
import { Composer } from "./Composer";
import { CommentMarker } from "./CommentMarker";
import { CommentThread } from "./CommentThread";

const queryClient = new QueryClient();
const ZERO_UID = "0x" + "00".repeat(32);

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

function CommentController({ lang }: Props) {
  const signer = useEthersSigner();
  const { address } = useAccount();
  const qc = useQueryClient();

  const [walletSlot, setWalletSlot] = useState<Element | null>(null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const [commentsOn, setCommentsOn] = useState(false);
  const [openBlock, setOpenBlock] = useState<string | null>(null);

  // Optimistic comments live as full StoredComments; `pending` tracks the
  // temp-uids that are still unconfirmed so one list + one renderer handles both.
  const [optimistic, setOptimistic] = useState<StoredComment[]>([]);
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // Projected comments per block, for the thread panel (kept in a ref because the
  // projection effect already drives a re-render via its own setState companion).
  const projectedByBlock = useRef<Map<string, ProjectedComment[]>>(new Map());
  const [commentedBlocks, setCommentedBlocks] = useState<string[]>([]);

  // Capture the selection target when opening the composer, so it is stable
  // even after the DOM selection is cleared.
  const capturedTarget = useRef<SelectionTarget | null>(null);

  // All confirmed comments for the schema (refetched after a successful attest).
  const { data: stored = [] } = useQuery({
    queryKey: ["comments", SCHEMA_UID],
    queryFn: () => fetchComments(SCHEMA_UID),
    enabled: !!SCHEMA_UID,
    staleTime: 15000,
  });

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

  // Close the thread panel when commentary is turned off.
  useEffect(() => {
    if (!commentsOn) setOpenBlock(null);
  }, [commentsOn]);

  // selectionchange listener gated by data-comments="on".
  useEffect(() => {
    function onSelectionChange() {
      if (!commentsEnabled()) {
        setSelection(null);
        return;
      }
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

  // Project the (lang-filtered) comments per block and paint inline highlights.
  // Re-runs whenever the merged list, language, or on/off state changes.
  useEffect(() => {
    const byBlock = projectedByBlock.current;
    byBlock.clear();

    if (!commentsOn) {
      applyHighlights("comment", []);
      setCommentedBlocks([]);
      return;
    }

    // Filter to this page's language, then group by block.
    const groups = new Map<string, StoredComment[]>();
    for (const c of merged) {
      if (c.lang !== lang) continue;
      const arr = groups.get(c.blockId) ?? [];
      arr.push(c);
      groups.set(c.blockId, arr);
    }

    const ranges: Range[] = [];
    const blocks: string[] = [];
    for (const [blockId, group] of groups) {
      const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!blockEl) continue;
      const projected = projectComments(blockEl, group);
      byBlock.set(blockId, projected);
      blocks.push(blockId);
      for (const p of projected) {
        const s = p.projection.status;
        if (s !== "anchored" && s !== "re-anchored") continue;
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r) ranges.push(r);
      }
    }

    applyHighlights("comment", ranges);
    setCommentedBlocks(blocks);
  }, [merged, lang, commentsOn]);

  function openComposer() {
    capturedTarget.current = selection;
    setComposerError(null);
    setComposerOpen(true);
  }

  async function handleSubmit(body: string) {
    const target = capturedTarget.current;
    if (!target) return;

    if (!signer || !SCHEMA_UID) {
      setComposerError("Connect a wallet on Sepolia (and set PUBLIC_EAS_SCHEMA_UID).");
      return;
    }

    const { anchor, blockId } = target;
    const chapter = blockId.slice(0, 2);
    const fields = {
      chapter,
      blockId,
      lang,
      blockHash: anchor.blockHash,
      spanStart: anchor.start,
      spanEnd: anchor.end,
      spanExact: anchor.exact,
      spanPrefix: anchor.prefix,
      spanSuffix: anchor.suffix,
      parentUid: ZERO_UID,
      body,
    };

    const tempUid = `opt-${Date.now()}`;
    const optimisticComment: StoredComment = {
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
      const uid = await attestComment(signer, SCHEMA_UID, encodeComment(fields));
      // Swap the temp-uid → the real returned uid, then refetch so the confirmed
      // attestation arrives from EAS and the optimistic dupe collapses by uid.
      setOptimistic((prev) => prev.map((c) => (c.uid === tempUid ? { ...c, uid } : c)));
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(tempUid);
        return next;
      });
      qc.invalidateQueries({ queryKey: ["comments", SCHEMA_UID] });
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

  const isPending = (c: StoredComment) => pending.has(c.uid);

  // Gutter badge per commented block → opens that block's thread panel.
  const gutterPortals = commentedBlocks.map((blockId) => {
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    const gutter = blockEl?.querySelector(".gutter") ?? null;
    if (!gutter) return null;
    const group = projectedByBlock.current.get(blockId) ?? [];
    return createPortal(
      <CommentMarker
        count={group.length}
        pending={group.some((p) => isPending(p.comment))}
        onClick={() => setOpenBlock(blockId)}
      />,
      gutter,
      blockId,
    );
  });

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
      />
      {gutterPortals}
      {openBlock ? (
        <CommentThread
          projected={projectedByBlock.current.get(openBlock) ?? []}
          lang={lang}
          onClose={() => setOpenBlock(null)}
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
