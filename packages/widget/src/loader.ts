// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + a single floating pill (💬 + count) AND a selection "Comment"
// popover. Tapping the pill toggles "comments" (open sidebar + paint highlights);
// selecting text shows the popover, which opens the panel in compose mode — or, if
// already open, re-loads the composer with the new selection. Lazy-imports the
// React app on first open.
import { readConfig } from "./config";
import { createDisplay } from "./display";
import { nearestContainer } from "@anno/core/anno/selector";

// Tabler "pencil-bolt" icon paths (the launcher pill).
const PENCIL =
  '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/>' +
  '<path d="M13.5 6.5l4 4"/>' +
  '<path d="M19 16l-2 3h4l-2 3"/>';

// Tabler "pencil-plus" icon paths (the selection "add a comment here" popover).
const PENCIL_PLUS =
  '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/>' +
  '<path d="M13.5 6.5l4 4"/>' +
  '<path d="M16 19h6"/>' +
  '<path d="M19 16v6"/>';

function mount(): void {
  if (document.getElementById("annotation-widget")) return; // singleton guard
  const config = readConfig();

  const host = document.createElement("div");
  host.id = "annotation-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const side = config.position === "bottom-left" ? "left:20px" : "right:20px";
  const button = document.createElement("button");
  button.type = "button";
  button.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;gap:6px;` +
    "padding:7px 11px;background:#0c0cff;color:#fff;border:1px solid #0c0cff;border-radius:0;cursor:pointer;" +
    "font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:3px 3px 0 rgba(165,165,255,.5)";
  shadow.appendChild(button);

  // Floating "Comment" popover shown over a text selection (same pill design).
  const popover = document.createElement("button");
  popover.type = "button";
  popover.style.cssText =
    "position:fixed;z-index:2147483646;display:none;align-items:center;gap:6px;" +
    "padding:6px 11px;background:#0c0cff;color:#fff;border:1px solid #0c0cff;border-radius:0;cursor:pointer;" +
    "box-shadow:3px 3px 0 rgba(165,165,255,.5);font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace";
  popover.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PENCIL_PLUS}</svg><span>Comment</span>`;
  shadow.appendChild(popover);

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  let appMod: typeof import("./app") | null = null;
  let mounted = false;
  let loaded = false; // false until the first refresh resolves → show a [...] placeholder
  let appClose: (() => void) | null = null;
  let focusWhileOpen: ((uid: string) => void) | null = null;
  let composeWhileOpen: ((range: Range) => void) | null = null;
  let captured: Range | null = null;

  function renderButton(): void {
    if (mounted) {
      // Open → a square close (✕) button. The ✕ svg uses stroke:currentColor → cobalt.
      button.style.padding = "7px";
      button.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    } else {
      // Closed → pencil icon + a bracketed count, white on the cobalt fill.
      // Until the first refresh resolves, show a [...] placeholder so the button
      // never flashes an empty/zero state during initial load.
      button.style.padding = "7px 11px";
      const count = loaded ? `[${display.count()}]` : "[...]";
      button.innerHTML =
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PENCIL}</svg>` +
        `<span style="font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;opacity:.7">${count}</span>`;
    }
    const label = mounted ? "Close comments" : "Open comments";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(mounted));
  }

  // Open = mount the panel + show highlights. focusUid focuses a span; composeRange
  // opens the composer for that selection. When already open, route to the app.
  async function openApp(
    opts: { focusUid?: string; composeRange?: Range } = {},
  ): Promise<void> {
    if (mounted) {
      if (opts.focusUid) focusWhileOpen?.(opts.focusUid);
      if (opts.composeRange) composeWhileOpen?.(opts.composeRange);
      return;
    }
    mounted = true;
    display.setVisible(true);
    renderButton();
    if (!appMod) appMod = await import("./app");
    appClose = appMod.mountApp(shadow, config, display, {
      focusUid: opts.focusUid,
      composeRange: opts.composeRange,
      onFocusReady: (fn) => {
        focusWhileOpen = fn;
      },
      onComposeReady: (fn) => {
        composeWhileOpen = fn;
      },
      onUnmount: () => {
        mounted = false;
        focusWhileOpen = null;
        composeWhileOpen = null;
        appClose = null;
        display.setVisible(false);
        renderButton();
      },
    });
  }

  // Selection → position + show the Comment popover (capturing the range). Shadow
  // selections (the panel's own text) don't surface in document.getSelection().
  function updatePopover(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      popover.style.display = "none";
      captured = null;
      return;
    }
    const range = sel.getRangeAt(0);
    if (nearestContainer(range.commonAncestorContainer) === null) {
      popover.style.display = "none";
      captured = null;
      return;
    }
    captured = range.cloneRange();
    const rect = range.getBoundingClientRect();
    popover.style.top = `${Math.max(8, rect.top - 38)}px`;
    popover.style.left = `${rect.left}px`;
    popover.style.display = "inline-flex";
  }
  // selectionchange fires in bursts (every caret tick during a drag); coalesce to
  // one rAF so we do a single layout read (getBoundingClientRect) per frame.
  let rafPending = 0;
  document.addEventListener("selectionchange", () => {
    if (rafPending) return;
    rafPending = requestAnimationFrame(() => {
      rafPending = 0;
      updatePopover();
    });
  });

  button.addEventListener("click", () => {
    if (mounted)
      appClose?.(); // on → close (clears highlights via onUnmount)
    else void openApp(); // off → open + show highlights
  });
  popover.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection alive
  popover.addEventListener("click", () => {
    const range = captured;
    if (!range) return;
    void openApp({ composeRange: range }); // open (or re-compose) with this selection
    popover.style.display = "none";
  });
  display.onClickHighlight((uid) => void openApp({ focusUid: uid }));

  renderButton(); // paint the icon + [...] placeholder immediately (pre-load)
  void display.refresh().then(() => {
    loaded = true;
    renderButton();
  });
}

mount();
