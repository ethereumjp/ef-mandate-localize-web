// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static build, always served at root (IPNS subdomain / ENS gateways, DNSLink).
// Path gateways (…/ipns/<name>/…) are not supported — the site uses absolute paths.
// SITE_URL sets the canonical origin for absolute URLs (sitemap / canonical / OG).
export default defineConfig({
  site: process.env.SITE_URL,
  base: "/",
  vite: {
    plugins: [tailwindcss()],
    // @anno/core ships TS source; transform it (don't externalize) and
    // don't pre-bundle the workspace package.
    ssr: { noExternal: ["@anno/core"] },
    optimizeDeps: { exclude: ["@anno/core"] },
  },
});
