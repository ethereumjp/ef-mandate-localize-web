// EAS deployments per network. Addresses verified against
// https://github.com/ethereum-attestation-service/eas-contracts (v0.26).
export type NetworkName = "mainnet" | "sepolia";

export interface NetworkConfig {
  name: NetworkName;
  /** Human label for UI ("Ethereum" / "Sepolia"). */
  label: string;
  chainId: number;
  /** EAS contract. */
  eas: string;
  /** SchemaRegistry contract. */
  schemaRegistry: string;
  /** EAS GraphQL endpoint (read path). */
  graphql: string;
  /** easscan base URL (UI links). */
  easscan: string;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: "mainnet",
    label: "Ethereum",
    chainId: 1,
    eas: "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587",
    schemaRegistry: "0xA7b39296258348C78294F95B872b282326A97BDF",
    graphql: "https://easscan.org/graphql",
    easscan: "https://easscan.org",
  },
  sepolia: {
    name: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
    eas: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
    schemaRegistry: "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0",
    graphql: "https://sepolia.easscan.org/graphql",
    easscan: "https://sepolia.easscan.org",
  },
};

/** Production default — used when no network is specified. */
export const DEFAULT_NETWORK: NetworkName = "mainnet";

/** Resolve a network by name, falling back to the production default (mainnet). */
export function resolveNetwork(name?: string): NetworkConfig {
  return NETWORKS[name as NetworkName] ?? NETWORKS[DEFAULT_NETWORK];
}
