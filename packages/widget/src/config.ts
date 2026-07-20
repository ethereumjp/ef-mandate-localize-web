import { ANNO_SCHEMA_UID } from "@anno/core/anno/constants";

export interface WidgetConfig {
  schemaUid: string;
  network: string;
  rpc?: string;
  mainnetRpc?: string;
  easGraphql?: string;
  position: string;
  lang: string;
  mock: boolean;
}

/**
 * Resolve the target network. `?mode=testnet` in the URL forces Sepolia (for the
 * demo / local dev); otherwise an explicit `data-network` wins, falling back to
 * mainnet — the production default.
 */
export function resolveNetworkName(dataNetwork: string | undefined, search: string): string {
  if (new URLSearchParams(search).get("mode") === "testnet") return "sepolia";
  return dataNetwork ?? "mainnet";
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
    schemaUid: d.schemaUid || ANNO_SCHEMA_UID,
    network: resolveNetworkName(d.network, location.search),
    rpc: d.rpc,
    mainnetRpc: d.mainnetRpc,
    easGraphql: d.easGraphql,
    position: d.position ?? "bottom-right",
    lang: d.lang || document.documentElement.lang || "en",
    mock: d.mock === "1" || d.mock === "true",
  };
}
