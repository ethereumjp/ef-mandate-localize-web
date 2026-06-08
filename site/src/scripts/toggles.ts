// Client-only: theme + commentary state + keep-your-place language links.
const root = document.documentElement;

// Commentary on/off (persisted). `data-lang` / `data-theme` are set per page load.
const savedComments = localStorage.getItem("comments") === "on" ? "on" : "off";
root.dataset.comments = savedComments;

const commentsBtn = document.querySelector<HTMLElement>("[data-toggle-comments]");
commentsBtn?.setAttribute("aria-checked", String(savedComments === "on"));
commentsBtn?.addEventListener("click", () => {
  const next = root.dataset.comments === "on" ? "off" : "on";
  root.dataset.comments = next;
  localStorage.setItem("comments", next);
  commentsBtn.setAttribute("aria-checked", String(next === "on"));
});

// Dark / light theme (initialised by the inline <head> script; persisted here).
const themeBtn = document.querySelector<HTMLElement>("[data-toggle-theme]");
themeBtn?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// Language is route-based (/ = en, /ja = ja, …); navigate on change, carrying the hash
// so the reader keeps their place.
const langSelect = document.querySelector<HTMLSelectElement>("[data-lang-select]");
langSelect?.addEventListener("change", () => {
  location.href = langSelect.value + location.hash;
});
