// Stage 1 (loader): tiny, no React/wallet. Mounts a host element + shadow root,
// injects a floating button, and lazy-imports the heavy app on first interaction.
// (Skeleton: button + lazy-load. Display controller + config wiring added next.)

function mount(): void {
  if (document.getElementById("commentary-widget")) return; // singleton guard
  const host = document.createElement("div");
  host.id = "commentary-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Comments");
  button.textContent = "💬";
  button.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483646;width:48px;height:48px;" +
    "border-radius:9999px;border:none;background:#1c1917;color:#fff;font-size:20px;" +
    "cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2)";
  shadow.appendChild(button);

  let appMounted = false;
  button.addEventListener("click", async () => {
    if (appMounted) return;
    appMounted = true;
    const { mountApp } = await import("./app");
    mountApp(shadow);
  });
}

mount();
