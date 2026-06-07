// Client-only: theme + commentary state + keep-your-place language links.
const root = document.documentElement;

// Commentary on/off (persisted). `data-lang` / `data-theme` are set per page load.
const savedComments = localStorage.getItem("comments") === "on" ? "on" : "off";
root.dataset.comments = savedComments;

const commentsBtn = document.querySelector<HTMLElement>("[data-toggle-comments]");
commentsBtn?.addEventListener("click", () => {
  const next = root.dataset.comments === "on" ? "off" : "on";
  root.dataset.comments = next;
  localStorage.setItem("comments", next);
});

// Dark / light theme (initialised by the inline <head> script; persisted here).
const themeBtn = document.querySelector<HTMLElement>("[data-toggle-theme]");
themeBtn?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// Language is route-based (/ = en, /ja = ja); carry the current section hash across.
function syncLangLinks() {
  const hash = location.hash;
  for (const el of document.querySelectorAll<HTMLAnchorElement>("[data-lang-link]")) {
    const base = el.dataset.langLink === "ja" ? "/ja" : "/";
    el.setAttribute("href", base + hash);
  }
}
syncLangLinks();
addEventListener("hashchange", syncLangLinks);
