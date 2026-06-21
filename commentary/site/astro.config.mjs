// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Published as a GitHub Pages project site on the fork:
// https://yujiym.github.io/ef-mandate-localize-jp/  → base is the repo path.
// Override both via env in other deploys (custom domain → base "/").
export default defineConfig({
  site: process.env.SITE_URL ?? "https://yujiym.github.io",
  base: process.env.BASE_PATH ?? "/ef-mandate-localize-jp",
  vite: {
    plugins: [tailwindcss()],
    // @commentary/core ships TS source; transform it (don't externalize) and
    // don't pre-bundle the workspace package.
    ssr: { noExternal: ["@commentary/core"] },
    optimizeDeps: { exclude: ["@commentary/core"] },
  },
});
