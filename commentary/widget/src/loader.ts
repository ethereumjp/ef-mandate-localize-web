// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + a 2-cell floating pill — 💬 toggles highlight visibility (persisted,
// default OFF), the count opens the panel. Runs the framework-free display
// controller and lazy-imports the heavy React app on interaction.
import { readConfig } from "./config";
import { createDisplay } from "./display";

const VKEY = "commentary:visible";
function readVisible(): boolean {
  try {
    return localStorage.getItem(VKEY) === "1";
  } catch {
    return false; // private mode → default OFF, in-memory only
  }
}
function writeVisible(on: boolean): void {
  try {
    localStorage.setItem(VKEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Heroicons chat-bubble path, shared by the toggle's on/off renders.
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
  const pill = document.createElement("div");
  pill.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;` +
    "background:#1c1917;border-radius:9999px;box-shadow:0 4px 16px rgba(0,0,0,.2);overflow:hidden";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;border:none;background:transparent;cursor:pointer;padding:11px 13px";

  const divider = document.createElement("span");
  divider.style.cssText = "width:1px;align-self:stretch;background:rgba(255,255,255,.18)";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.setAttribute("aria-label", "Open comments");
  openBtn.style.cssText =
    "border:none;background:transparent;cursor:pointer;padding:11px 15px;color:#fff;font:600 14px/1 system-ui";

  pill.append(toggleBtn, divider, openBtn);
  shadow.appendChild(pill);

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  let visible = readVisible();

  function renderToggle(): void {
    const stroke = visible ? "#fde68a" : "#a8a29e";
    const slash = visible
      ? ""
      : '<line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="#a8a29e" stroke-width="1.7"/>';
    toggleBtn.style.background = visible ? "rgba(251,191,36,.22)" : "transparent";
    const label = visible ? "Hide comments" : "Show comments";
    toggleBtn.title = label;
    toggleBtn.setAttribute("aria-label", label);
    toggleBtn.setAttribute("aria-pressed", String(visible));
    toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7">${BUBBLE}${slash}</svg>`;
  }
  function renderCount(): void {
    openBtn.textContent = String(display.count());
  }

  let appMod: typeof import("./app") | null = null;
  let mounted = false;
  let focusWhileOpen: ((uid: string) => void) | null = null;
  async function openApp(focusUid?: string): Promise<void> {
    if (mounted) {
      if (focusUid) focusWhileOpen?.(focusUid); // already open → just focus the span
      return;
    }
    mounted = true;
    if (!appMod) appMod = await import("./app");
    appMod.mountApp(shadow, config, display, {
      focusUid,
      onFocusReady: (fn) => {
        focusWhileOpen = fn;
      },
      onUnmount: () => {
        mounted = false;
        focusWhileOpen = null;
      },
    });
  }

  toggleBtn.addEventListener("click", () => {
    visible = !visible;
    writeVisible(visible);
    display.setVisible(visible);
    renderToggle();
  });
  openBtn.addEventListener("click", () => void openApp());
  display.onClickHighlight((uid) => void openApp(uid));

  void display.refresh().then(() => {
    display.setVisible(visible); // apply persisted state (paints if ON)
    renderToggle();
    renderCount();
  });
}

mount();
