// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // @commentary/core ships TS source; transform it (don't externalize) and
    // don't pre-bundle the workspace package.
    ssr: { noExternal: ["@commentary/core", "@commentary/widget"] },
    optimizeDeps: { exclude: ["@commentary/core", "@commentary/widget"] },
  },
});
