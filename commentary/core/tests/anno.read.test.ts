import { describe, it, expect } from "vitest";
import { encodeAbiParameters } from "viem";
import { ANNO_ABI } from "../src/anno/encode-defs";
import { fetchAnno, decodeAttestation } from "../src/anno/read";

function mockFetch(captured: { body?: any }) {
  return (async (_url: string, init: { body: string }) => {
    captured.body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: { attestations: [] } }) };
  }) as unknown as typeof fetch;
}

// Build attestation `data` from the (post-Task-3) ABI: no parentUid field.
function encodeData(over: Partial<Record<string, unknown>> = {}): `0x${string}` {
  const base: Record<string, unknown> = {
    url: "https://example.com/p",
    urlCanonical: "https://example.com/p",
    origin: "https://example.com",
    lang: "en",
    rootSelector: "p:nth-of-type(1)",
    containerHash: "0x" + "11".repeat(32),
    spanStart: 0,
    spanEnd: 3,
    spanExact: "abc",
    spanPrefix: "",
    spanSuffix: "",
    body: "hi",
    meta: "",
    ...over,
  };
  return encodeAbiParameters(
    ANNO_ABI,
    ANNO_ABI.map((p) => base[p.name]) as never,
  );
}

describe("decodeAttestation", () => {
  it("sources parentUid from the envelope refUID", () => {
    const parent = "0x" + "ab".repeat(32);
    const c = decodeAttestation({
      id: "0x" + "cd".repeat(32),
      attester: "0x0000000000000000000000000000000000000001",
      time: 1717000000,
      revoked: false,
      refUID: parent,
      data: encodeData(),
    });
    expect(c.parentUid).toBe(parent);
    expect(c.body).toBe("hi");
  });
});

describe("fetchAnno", () => {
  it("scopes the query to the page recipient", async () => {
    const cap: { body?: any } = {};
    await fetchAnno("0xschema", { pageKey: "0xPAGEADDR", fetchImpl: mockFetch(cap) });
    expect(cap.body.variables.schemaId).toBe("0xschema");
    expect(cap.body.variables.recipient).toBe("0xPAGEADDR");
    expect(cap.body.query).toContain("recipient: { equals: $recipient }");
  });

  it("returns [] for an empty schemaUid without fetching", async () => {
    const cap: { body?: any } = {};
    const out = await fetchAnno("", { pageKey: "0xPAGEADDR", fetchImpl: mockFetch(cap) });
    expect(out).toEqual([]);
    expect(cap.body).toBeUndefined();
  });
});
