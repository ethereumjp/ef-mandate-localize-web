// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readConfig, resolveNetworkName } from "../src/config";

describe("resolveNetworkName", () => {
  it("defaults to mainnet with no flag or data-network", () => {
    expect(resolveNetworkName(undefined, "")).toBe("mainnet");
    expect(resolveNetworkName(undefined, "?foo=1")).toBe("mainnet");
  });

  it("?mode=testnet forces sepolia", () => {
    expect(resolveNetworkName(undefined, "?mode=testnet")).toBe("sepolia");
    expect(resolveNetworkName(undefined, "?x=1&mode=testnet")).toBe("sepolia");
    // overrides an explicit data-network too
    expect(resolveNetworkName("mainnet", "?mode=testnet")).toBe("sepolia");
  });

  it("ignores other mode values / bare testnet", () => {
    expect(resolveNetworkName(undefined, "?mode=prod")).toBe("mainnet");
    expect(resolveNetworkName(undefined, "?testnet")).toBe("mainnet");
  });

  it("honors an explicit data-network when no testnet mode is present", () => {
    expect(resolveNetworkName("sepolia", "")).toBe("sepolia");
    expect(resolveNetworkName("mainnet", "?other=1")).toBe("mainnet");
  });
});

describe("readConfig", () => {
  it("falls back to 'en' when neither data-lang nor <html lang> is set", () => {
    document.documentElement.removeAttribute("lang"); // documentElement.lang === ""
    const s = document.createElement("script");
    s.dataset.schemaUid = "0xabc";
    document.head.appendChild(s);
    try {
      expect(readConfig().lang).toBe("en");
    } finally {
      s.remove();
    }
  });
});
