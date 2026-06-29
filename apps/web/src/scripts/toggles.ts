// Client-only: theme toggle + keep-your-place language links. (Annotation
// visibility is now owned by the embedded widget, not the site toolbar.)
const root = document.documentElement;

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
