// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static site. `base` stays "/" (works for local preview, IPFS, and eth.limo).
// A GitHub Pages project base path is a deploy-time concern (M6).
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
