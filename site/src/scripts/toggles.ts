// Client-only: reflect saved language + commentary state onto <html>, and wire buttons.
type Lang = "en" | "ja";

const root = document.documentElement;

const savedLang = (localStorage.getItem("lang") as Lang | null) ?? "en";
const savedComments = localStorage.getItem("comments") === "on" ? "on" : "off";
root.dataset.lang = savedLang;
root.dataset.comments = savedComments;

for (const el of document.querySelectorAll<HTMLElement>("[data-set-lang]")) {
  el.addEventListener("click", () => {
    const lang = el.dataset.setLang as Lang;
    root.dataset.lang = lang;
    localStorage.setItem("lang", lang);
  });
}

const commentsBtn = document.querySelector<HTMLElement>("[data-toggle-comments]");
commentsBtn?.addEventListener("click", () => {
  const next = root.dataset.comments === "on" ? "off" : "on";
  root.dataset.comments = next;
  localStorage.setItem("comments", next);
});
