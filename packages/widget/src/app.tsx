// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts the
// comment controller — a Panel with list/compose modes + wallet in the header —
// into the shadow root, Tailwind injected via adoptedStyleSheets. Text selection
// + the Comment popover live in the Stage-1 loader; this controller receives
// compose requests (an initial range and/or later ranges via onComposeReady) and
// reuses the Stage-1 `display` for read/paint/focus.
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildAnnoFields } from "@anno/core/anno/author";
import { encodeAnno } from "@anno/core/anno/encode";
import { pageKey } from "@anno/core/anno/pageKey";
import { EMPTY_UID } from "@anno/core/anno/constants";
import type { AnnoFields } from "@anno/core/anno/schema";
import type { StoredAnno } from "@anno/core/anno/locate";
import { resolveNetwork } from "@anno/core/chain";
import { buildWagmiConfig } from "./web3/config";
import { useEthersSigner } from "./web3/ethers";
import { attestComment } from "./web3/eas";
import { ConnectButton } from "./comments/ConnectButton";
import { CommentThread } from "./comments/CommentThread";
import { Composer } from "./comments/Composer";
import { Panel } from "./comments/Panel";
import type { WidgetConfig } from "./config";
import type { Display } from "./display";
import css from "./app.css?inline";

const queryClient = new QueryClient();
const styled = new WeakSet<ShadowRoot>();

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** A reply inherits the parent's anchor (same span); only body changes; refUID wired on submit. */
function replyFields(parent: StoredAnno, body: string): AnnoFields {
  return {
    url: parent.url,
    urlCanonical: parent.urlCanonical,
    origin: parent.origin,
    lang: parent.lang,
    rootSelector: parent.rootSelector,
    containerHash: parent.containerHash,
    spanStart: parent.spanStart,
    spanEnd: parent.spanEnd,
    spanExact: parent.spanExact,
    spanPrefix: parent.spanPrefix,
    spanSuffix: parent.spanSuffix,
    body,
    meta: "",
  };
}

function injectStyles(shadow: ShadowRoot): void {
  if (styled.has(shadow)) return;
  styled.add(shadow);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
}

interface ControllerProps {
  config: WidgetConfig;
  display: Display;
  initialFocusUid?: string;
  onFocusReady?: (fn: (uid: string) => void) => void;
  /** Selection to compose on mount (opened via the loader's Comment popover). */
  initialComposeRange?: Range;
  /** Hand the loader a callback so later selections re-load the composer while open. */
  onComposeReady?: (fn: (range: Range) => void) => void;
}

function Controller({
  config,
  display,
  initialFocusUid,
  onFocusReady,
  initialComposeRange,
  onComposeReady,
}: ControllerProps) {
  const signer = useEthersSigner();
  const net = resolveNetwork(config.network);
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [comments, setComments] = useState(display.projected());
  useEffect(
    () => display.onChange(() => setComments(display.projected())),
    [display],
  );
  const [focusedUid, setFocusedUid] = useState<string | null>(initialFocusUid ?? null);
  const [mode, setMode] = useState<"list" | "compose">("list");
  const [composerFields, setComposerFields] = useState<AnnoFields | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const composeRange = useRef<Range | null>(null);
  const replyParent = useRef<StoredAnno | null>(null);

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

  const fieldsFor = useCallback(
    (range: Range, body: string): AnnoFields | null =>
      buildAnnoFields({ href: location.href, lang: config.lang, range, body }),
    [config.lang],
  );

  // Open the composer for a selection (from the loader's popover): on mount via
  // initialComposeRange, or later via onComposeReady. Re-loads with each new range.
  const openComposer = useCallback(
    (range: Range) => {
      composeRange.current = range;
      replyParent.current = null; // a fresh selection is a new top-level comment
      setReplyTo(null);
      setComposerError(null);
      setComposerFields(fieldsFor(range, ""));
      setMode("compose");
    },
    [fieldsFor],
  );
  useEffect(() => {
    if (initialComposeRange) openComposer(initialComposeRange);
    onComposeReady?.(openComposer);
  }, [initialComposeRange, onComposeReady, openComposer]);

  // Reply: inherit the parent's span; the composer previews that quote and the
  // new comment links to the parent via refUID. No text selection involved.
  const handleReply = useCallback((parent: StoredAnno) => {
    composeRange.current = null;
    replyParent.current = parent;
    setReplyTo(short(parent.attester));
    setComposerError(null);
    setComposerFields(replyFields(parent, ""));
    setMode("compose");
  }, []);

  function backToList() {
    replyParent.current = null;
    setReplyTo(null);
    setMode("list");
    setComposerError(null);
  }

  async function handleSubmit(body: string) {
    if (!signer || !config.schemaUid) {
      setComposerError(`Connect a wallet on ${net.label} to publish.`);
      return;
    }
    let fields: AnnoFields | null;
    const parent = replyParent.current;
    if (parent) {
      fields = replyFields(parent, body);
    } else {
      const range = composeRange.current;
      if (!range) return;
      fields = fieldsFor(range, body);
      if (!fields) {
        setComposerError("Could not anchor the selection. Try selecting within a single block.");
        return;
      }
    }
    setComposerPending(true);
    try {
      await attestComment(signer, config.schemaUid, encodeAnno(fields), {
        recipient: pageKey(fields.urlCanonical),
        refUID: parent ? parent.uid : EMPTY_UID,
        eas: net.eas,
      });
      await display.refresh();
      replyParent.current = null;
      setReplyTo(null);
      setMode("list");
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : String(err));
    } finally {
      setComposerPending(false);
    }
  }

  return (
    <Panel
      lang={config.lang}
      count={comments.length}
      mode={mode}
      wallet={<ConnectButton net={net} />}
      onBack={backToList}
    >
      {mode === "compose" ? (
        <Composer
          key={`${replyTo ?? ""}:${composerFields?.spanExact ?? "compose"}`}
          fields={composerFields}
          lang={config.lang}
          pending={composerPending}
          error={composerError}
          connected={isConnected}
          onConnect={() => connect({ connector: injected() })}
          onSubmit={handleSubmit}
          schemaUid={config.schemaUid}
          easscan={net.easscan}
          replyTo={replyTo ?? undefined}
        />
      ) : (
        <CommentThread
          comments={comments}
          lang={config.lang}
          focusedUid={focusedUid}
          onFocus={handleFocus}
          onReply={handleReply}
        />
      )}
    </Panel>
  );
}

function App(props: ControllerProps) {
  const [wagmiConfig] = useState(() =>
    buildWagmiConfig({ rpc: props.config.rpc, mainnetRpc: props.config.mainnetRpc }),
  );
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
    composeRange?: Range;
    onFocusReady?: (fn: (uid: string) => void) => void;
    onComposeReady?: (fn: (range: Range) => void) => void;
    onUnmount?: () => void;
  },
): () => void {
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
      initialFocusUid={opts?.focusUid}
      onFocusReady={opts?.onFocusReady}
      initialComposeRange={opts?.composeRange}
      onComposeReady={opts?.onComposeReady}
    />,
  );
  return close;
}
