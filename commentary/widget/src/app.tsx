// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts the
// comment controller (list + wallet + select→compose→attest authoring) into the
// shadow root, with Tailwind injected via adoptedStyleSheets so host CSS doesn't
// leak in or out. Reuses the Stage-1 `display` for read/paint; adds authoring.
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildAnnoFields } from "@commentary/core/anno/author";
import { nearestContainer } from "@commentary/core/anno/selector";
import { encodeAnno } from "@commentary/core/anno/encode";
import type { AnnoFields } from "@commentary/core/anno/schema";
import { buildWagmiConfig } from "./web3/config";
import { useEthersSigner } from "./web3/ethers";
import { attestComment } from "./web3/eas";
import { ConnectButton } from "./comments/ConnectButton";
import { CommentThread } from "./comments/CommentThread";
import { Composer } from "./comments/Composer";
import { SelectionPopover } from "./comments/SelectionPopover";
import type { WidgetConfig } from "./config";
import type { Display } from "./display";
import css from "./app.css?inline";

const queryClient = new QueryClient();
const NO_PENDING = new Set<string>();
const styled = new WeakSet<ShadowRoot>();

function injectStyles(shadow: ShadowRoot): void {
  if (styled.has(shadow)) return;
  styled.add(shadow);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
}

interface SelectionTarget {
  container: Element;
  range: Range;
  rect: DOMRect;
}

interface ControllerProps {
  config: WidgetConfig;
  display: Display;
  portalContainer: HTMLElement;
  onClose: () => void;
  /** Comment to focus on mount (opened by clicking its span). */
  initialFocusUid?: string;
  /** Hand the loader a focus callback so span-clicks route here while the panel is open. */
  onFocusReady?: (fn: (uid: string) => void) => void;
}

function Controller({
  config,
  display,
  portalContainer,
  onClose,
  initialFocusUid,
  onFocusReady,
}: ControllerProps) {
  const signer = useEthersSigner();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [comments, setComments] = useState(display.projected());
  const [focusedUid, setFocusedUid] = useState<string | null>(initialFocusUid ?? null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFields, setComposerFields] = useState<AnnoFields | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const captured = useRef<SelectionTarget | null>(null);

  // selectionchange → popover (authoring is independent of the comment list).
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = nearestContainer(range.commonAncestorContainer);
      if (!container) {
        setSelection(null);
        return;
      }
      const raw = range.getBoundingClientRect();
      const rect = new DOMRect(raw.left, Math.max(8, raw.top - 36), raw.width, raw.height);
      setSelection({ container, range: range.cloneRange(), rect });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Focus a comment from the list (or a span click routed by the loader): wash its
  // span + scroll it into view, and mark its card. Clear the wash when the panel closes.
  const handleFocus = useCallback(
    (uid: string) => {
      setFocusedUid(uid);
      display.focus(uid);
    },
    [display],
  );
  useEffect(() => {
    if (initialFocusUid) handleFocus(initialFocusUid);
    onFocusReady?.(handleFocus);
    return () => display.focus(null);
  }, [initialFocusUid, onFocusReady, handleFocus, display]);

  function fieldsFor(target: SelectionTarget, body: string): AnnoFields | null {
    return buildAnnoFields({ href: location.href, lang: config.lang, range: target.range, body });
  }

  function openComposer() {
    captured.current = selection;
    setComposerError(null);
    setComposerFields(selection ? fieldsFor(selection, "") : null);
    setComposerOpen(true);
  }

  async function handleSubmit(body: string) {
    const target = captured.current;
    if (!target) return;
    if (!signer || !config.schemaUid) {
      setComposerError("Connect a wallet on Sepolia to publish.");
      return;
    }
    const fields = fieldsFor(target, body);
    if (!fields) {
      setComposerError("Could not anchor the selection. Try selecting within a single block.");
      return;
    }
    setComposerOpen(false);
    setComposerPending(true);
    try {
      await attestComment(signer, config.schemaUid, encodeAnno(fields));
      await display.refresh();
      setComments(display.projected());
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : String(err));
      setComposerOpen(true);
    } finally {
      setComposerPending(false);
    }
  }

  return (
    <>
      <div className="fixed right-[352px] top-3 z-[2147483647]">
        <ConnectButton />
      </div>
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
        schemaUid={config.schemaUid}
        container={portalContainer}
      />
      <CommentThread
        comments={comments}
        lang={config.lang}
        focusedUid={focusedUid}
        pendingUids={NO_PENDING}
        onFocus={handleFocus}
        onClose={onClose}
      />
    </>
  );
}

function App(props: ControllerProps) {
  const [wagmiConfig] = useState(() => buildWagmiConfig({ rpc: props.config.rpc }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Controller {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function mountApp(
  container: ShadowRoot,
  config: WidgetConfig,
  display: Display,
  opts?: {
    focusUid?: string;
    onFocusReady?: (fn: (uid: string) => void) => void;
    onUnmount?: () => void;
  },
): void {
  injectStyles(container);
  const el = document.createElement("div");
  container.appendChild(el);
  const root = createRoot(el);
  const close = () => {
    root.unmount();
    el.remove();
    opts?.onUnmount?.();
  };
  root.render(
    <App
      config={config}
      display={display}
      portalContainer={el}
      onClose={close}
      initialFocusUid={opts?.focusUid}
      onFocusReady={opts?.onFocusReady}
    />,
  );
}
