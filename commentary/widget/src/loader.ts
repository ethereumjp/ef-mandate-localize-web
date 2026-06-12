// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + floating button, runs the framework-free display controller
// (fetch → project → paint highlights, on/off, count), and lazy-imports the heavy
// React app on interaction (open panel / click a highlight).
import { readConfig } from "./config";
import { createDisplay } from "./display";

function mount(): void {
  if (document.getElementById("commentary-widget")) return; // singleton guard
  const config = readConfig();

  const host = document.createElement("div");
  host.id = "commentary-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Comments");
  const side = config.position === "bottom-left" ? "left:20px" : "right:20px";
  button.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;height:44px;padding:0 14px;` +
    "border-radius:9999px;border:none;background:#1c1917;color:#fff;font:14px/1 system-ui;" +
    "cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:6px";
  shadow.appendChild(button);

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  function renderButton(): void {
    button.textContent = `💬 ${display.count()}`;
  }

  let appMod: typeof import("./app") | null = null;
  async function openApp(focusUid?: string): Promise<void> {
    if (!appMod) appMod = await import("./app");
    appMod.mountApp(shadow, config, display, { focusUid });
  }

  display.onClickHighlight((uid) => void openApp(uid));

  let visible = false;
  button.addEventListener("click", () => {
    visible = !visible;
    display.setVisible(visible);
    renderButton();
  });

  void display.refresh().then(renderButton);
}

mount();
