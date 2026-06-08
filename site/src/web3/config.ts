import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export { SEPOLIA_CHAIN_ID } from "./constants";

const RPC_URL =
  import.meta.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC_URL) },
});

// Read via bracket access so Vite does NOT statically inline this to a falsy
// literal. With dot access (import.meta.env.PUBLIC_EAS_SCHEMA_UID), an unset
// var folds to "" at build time, after which esbuild proves the attest branch
// in CommentApp (`if (!signer || !SCHEMA_UID) … else attest`) unreachable and
// dead-code-eliminates the entire EAS path (SchemaEncoder, attestComment, the
// SCHEMA string) out of the static client bundle — leaving on-chain publishing
// DEAD in the deployed IPFS build. Bracket access keeps SCHEMA_UID a runtime
// value, so the attest code is bundled and the guard still works at runtime.
export const SCHEMA_UID: string = import.meta.env["PUBLIC_EAS_SCHEMA_UID"] ?? "";
