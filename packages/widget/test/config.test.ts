// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findEmbedScript, readConfig, resolveNetworkName } from "../src/config";
import { ANNO_SCHEMA_UID } from "@anno/core/anno/constants";

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

describe("findEmbedScript", () => {
  it("prefers the script whose resolved src matches the module's own URL", () => {
    // A renamed bundle (no "embed.js" in the src, no data-schema-uid) plus a
    // decoy that the old heuristics would have matched first.
    const decoy = document.createElement("script");
    decoy.src = "https://other.example/embed.js";
    const own = document.createElement("script");
    own.src = "https://cdn.example/widget/anno.min.js";
    own.dataset.network = "sepolia";
    document.head.append(decoy, own);
    try {
      // jsdom resolves .src to an absolute URL — compare against that form.
      expect(findEmbedScript(own.src)).toBe(own);
    } finally {
      decoy.remove();
      own.remove();
    }
  });

  it("falls back to data-schema-uid, then an embed.js src, when no src matches", () => {
    const bySrc = document.createElement("script");
    bySrc.src = "https://example.ipns.dweb.link/embed.js";
    document.head.appendChild(bySrc);
    try {
      expect(findEmbedScript("file:///not-a-real-script.js")).toBe(bySrc);
      const byAttr = document.createElement("script");
      byAttr.setAttribute("data-schema-uid", "0xabc");
      document.head.appendChild(byAttr);
      try {
        expect(findEmbedScript("file:///not-a-real-script.js")).toBe(byAttr);
      } finally {
        byAttr.remove();
      }
    } finally {
      bySrc.remove();
    }
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

describe("readConfig schemaUid", () => {
  it("defaults to the built-in canonical UID when data-schema-uid is absent (src fallback finds the script)", () => {
    const s = document.createElement("script");
    s.src = "https://example.ipns.dweb.link/embed.js";
    document.head.appendChild(s);
    try {
      const c = readConfig();
      expect(c.schemaUid).toBe(ANNO_SCHEMA_UID);
      // the src*="embed.js" fallback also carried the other data-* defaults
      expect(c.network).toBe("mainnet");
    } finally {
      s.remove();
    }
  });

  it("data-schema-uid overrides the built-in default", () => {
    const s = document.createElement("script");
    s.dataset.schemaUid = "0xabc";
    document.head.appendChild(s);
    try {
      expect(readConfig().schemaUid).toBe("0xabc");
    } finally {
      s.remove();
    }
  });

  it("empty data-schema-uid falls back to the built-in default", () => {
    const s = document.createElement("script");
    s.setAttribute("data-schema-uid", "");
    document.head.appendChild(s);
    try {
      expect(readConfig().schemaUid).toBe(ANNO_SCHEMA_UID);
    } finally {
      s.remove();
    }
  });
});
