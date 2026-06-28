export interface WidgetConfig {
  schemaUid: string;
  network: string;
  rpc?: string;
  easGraphql?: string;
  position: string;
  lang: string;
  theme: string;
  mock: boolean;
}

/**
 * Find the `<script>` tag that loaded the embed. `document.currentScript` is null
 * for ES modules, so match by a `data-schema-uid` attr (preferred) or an
 * `embed.js` src.
 */
function findScript(): HTMLScriptElement | null {
  return (
    document.querySelector<HTMLScriptElement>("script[data-schema-uid]") ??
    document.querySelector<HTMLScriptElement>('script[src*="embed.js"]')
  );
}

/** Read the widget config from the embed `<script data-*>` (with defaults). */
export function readConfig(): WidgetConfig {
  const d = findScript()?.dataset ?? {};
  return {
    schemaUid: d.schemaUid ?? "",
    network: d.network ?? "sepolia",
    rpc: d.rpc,
    easGraphql: d.easGraphql,
    position: d.position ?? "bottom-right",
    lang: d.lang ?? document.documentElement.lang ?? "en",
    theme: d.theme ?? "auto",
    mock: d.mock === "1" || d.mock === "true",
  };
}
