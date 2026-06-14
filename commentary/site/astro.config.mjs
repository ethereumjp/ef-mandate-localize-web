// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // @commentary/core ships TS source; transform it (don't externalize) and
    // don't pre-bundle the workspace package.
    ssr: { noExternal: ["@commentary/core"] },
    optimizeDeps: { exclude: ["@commentary/core"] },
  },
});
