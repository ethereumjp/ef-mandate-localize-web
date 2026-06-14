// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + a single floating pill (💬 + count). Tapping toggles "comments":
// open the sidebar AND paint the underline highlights, or close + clear. Session-
// only (no persistence — every page starts closed; the count invites opening).
// Runs the framework-free display controller; lazy-imports the React app on open.
import { readConfig } from "./config";
import { createDisplay } from "./display";

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

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  let appMod: typeof import("./app") | null = null;
  let mounted = false;
  let appClose: (() => void) | null = null;
  let focusWhileOpen: ((uid: string) => void) | null = null;

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

  // Open = mount the panel + show highlights. Close (onUnmount) clears both.
  async function openApp(focusUid?: string): Promise<void> {
    if (mounted) {
      if (focusUid) focusWhileOpen?.(focusUid); // already open → just focus the span
      return;
    }
    mounted = true;
    display.setVisible(true);
    renderButton();
    if (!appMod) appMod = await import("./app");
    appClose = appMod.mountApp(shadow, config, display, {
      focusUid,
      onFocusReady: (fn) => {
        focusWhileOpen = fn;
      },
      onUnmount: () => {
        mounted = false;
        focusWhileOpen = null;
        appClose = null;
        display.setVisible(false);
        renderButton();
      },
    });
  }

  button.addEventListener("click", () => {
    if (mounted) appClose?.(); // on → close (clears highlights via onUnmount)
    else void openApp(); // off → open + show highlights
  });
  display.onClickHighlight((uid) => void openApp(uid));

  void display.refresh().then(renderButton);
}

mount();
