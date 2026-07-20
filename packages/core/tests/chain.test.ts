import { describe, expect, it } from "vitest";
import { NETWORKS, DEFAULT_NETWORK, resolveNetwork, resolveNetworkStrict } from "../src/chain";

describe("resolveNetwork", () => {
  it("returns the named network", () => {
    expect(resolveNetwork("sepolia").chainId).toBe(11155111);
    expect(resolveNetwork("mainnet").chainId).toBe(1);
  });

  it("defaults to mainnet for unknown / missing names", () => {
    expect(resolveNetwork(undefined).name).toBe(DEFAULT_NETWORK);
    expect(resolveNetwork("").name).toBe("mainnet");
    expect(resolveNetwork("goerli").name).toBe("mainnet");
  });

  it("carries the EAS + GraphQL config per network", () => {
    expect(NETWORKS.mainnet.eas).toBe("0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587");
    expect(NETWORKS.mainnet.graphql).toBe("https://easscan.org/graphql");
    expect(NETWORKS.sepolia.eas).toBe("0xC2679fBD37d54388Ce493F1DB75320D236e1815e");
    expect(NETWORKS.sepolia.graphql).toBe("https://sepolia.easscan.org/graphql");
  });

  it("every network carries a default public RPC endpoint", () => {
    expect(NETWORKS.mainnet.rpc).toBe("https://ethereum-rpc.publicnode.com");
    expect(NETWORKS.sepolia.rpc).toBe("https://ethereum-sepolia-rpc.publicnode.com");
  });
});

describe("resolveNetworkStrict", () => {
  it("resolves known names", () => {
    expect(resolveNetworkStrict("sepolia").name).toBe("sepolia");
  });
  it("defaults to mainnet when name is undefined", () => {
    expect(resolveNetworkStrict(undefined).name).toBe("mainnet");
  });
  it("throws on an unrecognized name instead of falling back to mainnet", () => {
    expect(() => resolveNetworkStrict("seploia")).toThrow(/unknown network/);
  });
});
