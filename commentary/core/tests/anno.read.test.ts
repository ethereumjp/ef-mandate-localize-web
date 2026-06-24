import { describe, it, expect } from "vitest";
import { fetchAnno } from "../src/anno/read";

function mockFetch(captured: { body?: any }) {
  return (async (_url: string, init: { body: string }) => {
    captured.body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: { attestations: [] } }) };
  }) as unknown as typeof fetch;
}

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
