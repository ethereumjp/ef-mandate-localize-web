import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { keccak256, stringToBytes } from "viem";
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
import type { Comment } from "../../web3/types";
import { ConnectButton } from "./ConnectButton";
import { SelectionPopover } from "./SelectionPopover";
import { Composer } from "./Composer";
import { CommentMarker } from "./CommentMarker";

const queryClient = new QueryClient();

interface Props {
  lang: string;
}

interface SelectionTarget {
  blockEl: Element;
  blockId: string;
  anchor: import("../../lib/anchoring").Anchor;
  rect: DOMRect;
}

function CommentController({ lang }: Props) {
  const signer = useEthersSigner();
  const { address } = useAccount();

  const [walletSlot, setWalletSlot] = useState<Element | null>(null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  // Capture the selection target when opening the composer, so it is stable
  // even after the DOM selection is cleared.
  const capturedTarget = useRef<SelectionTarget | null>(null);

  // Resolve #wallet-slot after mount (it exists in the static DOM at client:load).
  useEffect(() => {
    const el = document.getElementById("wallet-slot");
    if (el) setWalletSlot(el);
  }, []);

  // selectionchange listener gated by data-comments="on".
  useEffect(() => {
    function onSelectionChange() {
      if (document.documentElement.dataset.comments !== "on") {
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
    const parentUid = "0x" + "00".repeat(32);
    // Compute sourceId inline — do NOT import from src/lib/sources.ts (node:fs).
    const sourceId = keccak256(stringToBytes(`ethereumjp/ef-mandate-localize-jp@${lang}`));

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Comment = {
      uid: optimisticId,
      chapter,
      blockId,
      lang,
      body,
      spanStart: anchor.start,
      spanEnd: anchor.end,
      spanExact: anchor.exact,
      author: address ?? "you",
      pending: true,
    };

    setComments((prev) => [...prev, optimistic]);
    setComposerOpen(false);
    setComposerPending(true);

    try {
      const encoded = encodeComment({
        chapter,
        blockId,
        lang,
        sourceId,
        blockHash: anchor.blockHash,
        spanStart: anchor.start,
        spanEnd: anchor.end,
        spanExact: anchor.exact,
        spanPrefix: anchor.prefix,
        spanSuffix: anchor.suffix,
        parentUid,
        body,
      });
      const uid = await attestComment(signer, SCHEMA_UID, encoded);
      setComments((prev) =>
        prev.map((c) => (c.uid === optimisticId ? { ...c, uid, pending: false } : c)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setComments((prev) => prev.filter((c) => c.uid !== optimisticId));
      setComposerError(msg);
      setComposerOpen(true);
    } finally {
      setComposerPending(false);
    }
  }

  // Group comments by blockId for gutter markers.
  const byBlock = new Map<string, Comment[]>();
  for (const c of comments) {
    const arr = byBlock.get(c.blockId) ?? [];
    arr.push(c);
    byBlock.set(c.blockId, arr);
  }

  // Build portals for each commented block's .gutter.
  const gutterPortals = Array.from(byBlock.entries()).map(([blockId, list]) => {
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    const gutter = blockEl?.querySelector(".gutter") ?? null;
    if (!gutter) return null;
    return createPortal(<CommentMarker key={blockId} comments={list} />, gutter);
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
