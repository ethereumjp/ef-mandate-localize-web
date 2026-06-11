import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export { SEPOLIA_CHAIN_ID } from "./constants";

const RPC_URL =
  import.meta.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
// Mainnet is configured read-only so ENS names (whose reverse records live on L1)
// resolve even though all attestation activity stays on Sepolia.
const MAINNET_RPC_URL =
  import.meta.env.PUBLIC_MAINNET_RPC_URL ?? "https://ethereum-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(RPC_URL),
    [mainnet.id]: http(MAINNET_RPC_URL),
  },
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
// Generalized (anno) comment schema UID. Same bracket-access rationale as above:
// keep it a runtime value so the anno attest/read path is not dead-code-eliminated.
export const ANNO_SCHEMA_UID: string = import.meta.env["PUBLIC_EAS_ANNO_SCHEMA_UID"] ?? "";
