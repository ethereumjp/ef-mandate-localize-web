// Client-only: commentary on/off state + keep-your-place language links.
// `data-lang` is set per route (server-side), so this no longer touches it.
const root = document.documentElement;

const savedComments = localStorage.getItem("comments") === "on" ? "on" : "off";
root.dataset.comments = savedComments;

const commentsBtn = document.querySelector<HTMLElement>("[data-toggle-comments]");
commentsBtn?.addEventListener("click", () => {
  const next = root.dataset.comments === "on" ? "off" : "on";
  root.dataset.comments = next;
  localStorage.setItem("comments", next);
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
