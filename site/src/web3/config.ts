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

export const SCHEMA_UID = import.meta.env.PUBLIC_EAS_SCHEMA_UID ?? "";
