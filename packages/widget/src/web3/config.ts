import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Build a wagmi config from explicit RPC URLs (the embed passes these from its
 * `data-*` config). Both chains are registered: mainnet is the production
 * default, Sepolia is used when a page opts into testnet (`?mode=testnet`).
 * Registering mainnet also lets ENS names (whose records live on L1) resolve.
 */
export function buildWagmiConfig(opts: { rpc?: string; mainnetRpc?: string } = {}) {
  return createConfig({
    chains: [sepolia, mainnet],
    connectors: [injected()],
    transports: {
      [sepolia.id]: http(opts.rpc ?? "https://ethereum-sepolia-rpc.publicnode.com"),
      [mainnet.id]: http(opts.mainnetRpc ?? "https://ethereum-rpc.publicnode.com"),
    },
  });
}
