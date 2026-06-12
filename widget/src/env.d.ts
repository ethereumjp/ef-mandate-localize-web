// The widget reads `import.meta.env.PUBLIC_*` vars that the host bundler
// (Astro/Vite) injects at build time. Declare the contract so the widget
// type-checks standalone (no Vite dependency needed).
interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
