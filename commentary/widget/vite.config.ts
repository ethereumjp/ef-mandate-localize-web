import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Embed build: a single ESM `embed.js` (the loader) that lazy-imports a hashed
// `app` chunk on demand. Included on a host page via
// `<script type="module" src="…/embed.js" data-schema-uid=…></script>`.
// ESM + import.meta.url handles chunk-URL resolution natively (no currentScript hack).
// JSX via esbuild (automatic runtime) — no @vitejs/plugin-react needed for a build.
export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: { embed: "src/loader.ts" },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
});
