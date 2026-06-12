// Stage 2 (app): the heavy React chunk, lazy-imported by the loader. Mounts into
// the shadow root. (Skeleton: a trivial panel proving the lazy chunk + React +
// shadow render. The real CommentController is wired in next.)
import { createRoot } from "react-dom/client";

function Panel() {
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
      panel loaded
    </div>
  );
}

export function mountApp(container: ShadowRoot): void {
  const el = document.createElement("div");
  container.appendChild(el);
  createRoot(el).render(<Panel />);
}
