// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts the
// comment controller — a Panel with list/compose modes, wallet in the header, and
// select→compose→attest authoring — into the shadow root, with Tailwind injected
// via adoptedStyleSheets so host CSS doesn't leak in or out. Reuses the Stage-1
// `display` for read/paint/focus.
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
import { Panel } from "./comments/Panel";
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
  initialFocusUid?: string;
  onFocusReady?: (fn: (uid: string) => void) => void;
}

function Controller({ config, display, initialFocusUid, onFocusReady }: ControllerProps) {
  const signer = useEthersSigner();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [comments, setComments] = useState(display.projected());
  const [focusedUid, setFocusedUid] = useState<string | null>(initialFocusUid ?? null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [mode, setMode] = useState<"list" | "compose">("list");
  const [composerFields, setComposerFields] = useState<AnnoFields | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const captured = useRef<SelectionTarget | null>(null);

  // selectionchange → popover (only while listing; hidden during compose).
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
    setMode("compose");
  }

  function backToList() {
    setMode("list");
    setComposerError(null);
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
    setComposerPending(true);
    try {
      await attestComment(signer, config.schemaUid, encodeAnno(fields));
      await display.refresh();
      setComments(display.projected());
      setMode("list");
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : String(err));
    } finally {
      setComposerPending(false);
    }
  }

  return (
    <>
      {selection && mode === "list" ? (
        <SelectionPopover rect={selection.rect} onClick={openComposer} />
      ) : null}
      <Panel
        lang={config.lang}
        count={comments.length}
        mode={mode}
        wallet={<ConnectButton />}
        onBack={backToList}
      >
        {mode === "compose" ? (
          <Composer
            key={composerFields?.spanExact ?? "compose"}
            fields={composerFields}
            lang={config.lang}
            pending={composerPending}
            error={composerError}
            connected={isConnected}
            onConnect={() => connect({ connector: injected() })}
            onSubmit={handleSubmit}
            schemaUid={config.schemaUid}
          />
        ) : (
          <CommentThread
            comments={comments}
            lang={config.lang}
            focusedUid={focusedUid}
            pendingUids={NO_PENDING}
            onFocus={handleFocus}
          />
        )}
      </Panel>
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
    />,
  );
  return close;
}
