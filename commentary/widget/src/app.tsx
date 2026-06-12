// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts into
// the shadow root. (Interim: a trivial panel wired to the Stage-1 display; the
// real host-decoupled CommentController is integrated next.)
import { createRoot } from "react-dom/client";
import type { WidgetConfig } from "./config";
import type { Display } from "./display";

function Panel({ count }: { count: number }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        background: "#fff",
        borderLeft: "1px solid #e7e5e4",
        padding: 16,
        font: "14px system-ui, sans-serif",
        zIndex: 2147483647,
      }}
    >
      panel loaded ({count} comments)
    </div>
  );
}

export function mountApp(
  container: ShadowRoot,
  _config: WidgetConfig,
  display: Display,
  _opts?: { focusUid?: string },
): void {
  const el = document.createElement("div");
  container.appendChild(el);
  createRoot(el).render(<Panel count={display.count()} />);
}
