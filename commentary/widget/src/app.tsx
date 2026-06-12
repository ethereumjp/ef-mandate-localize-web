// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts a
// read panel (comment list + wallet connect) into the shadow root, with Tailwind
// injected via adoptedStyleSheets so host CSS doesn't leak in or out.
// (Interim: read-only list + connect; selection→compose authoring is wired by the
// full CommentController integration next.)
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildWagmiConfig } from "./web3/config";
import { ConnectButton } from "./comments/ConnectButton";
import { CommentThread } from "./comments/CommentThread";
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

function App({
  config,
  display,
  onClose,
}: {
  config: WidgetConfig;
  display: Display;
  onClose: () => void;
}) {
  const [wagmiConfig] = useState(() => buildWagmiConfig({ rpc: config.rpc }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div className="fixed right-[352px] top-3 z-[2147483647]">
          <ConnectButton />
        </div>
        <CommentThread
          comments={display.projected()}
          lang={config.lang}
          focusedUid={null}
          pendingUids={NO_PENDING}
          onFocus={() => {}}
          onClose={onClose}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function mountApp(
  container: ShadowRoot,
  config: WidgetConfig,
  display: Display,
  opts?: { focusUid?: string; onUnmount?: () => void },
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
  root.render(<App config={config} display={display} onClose={close} />);
}
