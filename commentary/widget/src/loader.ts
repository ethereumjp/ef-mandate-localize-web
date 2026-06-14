// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + a single floating pill (💬 + count) AND a selection "Comment"
// popover. Tapping the pill toggles "comments" (open sidebar + paint highlights);
// selecting text shows the popover, which opens the panel in compose mode — or, if
// already open, re-loads the composer with the new selection. Lazy-imports the
// React app on first open.
import { readConfig } from "./config";
import { createDisplay } from "./display";
import { nearestContainer } from "@commentary/core/anno/selector";

// Heroicons chat-bubble path.
const BUBBLE =
  '<path d="M12 20.25c4.97 0 9-3.69 9-8.25s-4.03-8.25-9-8.25S3 7.44 3 12c0 2.1.86 4.02 2.27 5.48.43.45.74 1.04.59 1.64a4.5 4.5 0 0 1-.92 1.79A5.97 5.97 0 0 0 6 21c1.28 0 2.47-.4 3.45-1.09.81.22 1.67.34 2.55.34Z"/>';

function mount(): void {
  if (document.getElementById("commentary-widget")) return; // singleton guard
  const config = readConfig();

  const host = document.createElement("div");
  host.id = "commentary-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const side = config.position === "bottom-left" ? "left:20px" : "right:20px";
  const button = document.createElement("button");
  button.type = "button";
  button.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;gap:6px;` +
    "padding:11px 15px;background:#1c1917;color:#fff;border:none;border-radius:9999px;cursor:pointer;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.2)";
  shadow.appendChild(button);

  // Floating "Comment" popover shown over a text selection (same pill design).
  const popover = document.createElement("button");
  popover.type = "button";
  popover.style.cssText =
    "position:fixed;z-index:2147483646;display:none;align-items:center;gap:6px;" +
    "padding:7px 12px;background:#1c1917;color:#fff;border:none;border-radius:9999px;cursor:pointer;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.2);font:500 12px/1 system-ui";
  popover.innerHTML =
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7">${BUBBLE}</svg><span>Comment</span>`;
  shadow.appendChild(popover);

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  let appMod: typeof import("./app") | null = null;
  let mounted = false;
  let appClose: (() => void) | null = null;
  let focusWhileOpen: ((uid: string) => void) | null = null;
  let composeWhileOpen: ((range: Range) => void) | null = null;
  let captured: Range | null = null;

  function renderButton(): void {
    if (mounted) {
      // Open → a clear close (✕) button.
      button.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    } else {
      // Closed → comment bubble + count (invites opening).
      button.innerHTML =
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d6d3d1" stroke-width="1.7">${BUBBLE}</svg>` +
        `<span style="font:600 14px/1 system-ui">${display.count()}</span>`;
    }
    const label = mounted ? "Close comments" : "Open comments";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(mounted));
  }

  // Open = mount the panel + show highlights. focusUid focuses a span; composeRange
  // opens the composer for that selection. When already open, route to the app.
  async function openApp(opts: { focusUid?: string; composeRange?: Range } = {}): Promise<void> {
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
  function onSelectionChange(): void {
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
  document.addEventListener("selectionchange", onSelectionChange);

  button.addEventListener("click", () => {
    if (mounted) appClose?.(); // on → close (clears highlights via onUnmount)
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

  void display.refresh().then(renderButton);
}

mount();
