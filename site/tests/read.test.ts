import { describe, it, expect } from "vitest";
import { fetchComments } from "../src/web3/read";
import { encodeComment, type CommentFields } from "../src/web3/schema";

const fields: CommentFields = {
  chapter: "02",
  blockId: "02-p7",
  lang: "ja",
  blockHash: "0x" + "22".repeat(32),
  spanStart: 4,
  spanEnd: 12,
  spanExact: "walkaway",
  spanPrefix: "the ",
  spanSuffix: " test",
  parentUid: "0x" + "00".repeat(32),
  body: "なるほど。",
};

function fakeFetch(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

describe("fetchComments", () => {
  it("decodes attestations into StoredComment[]", async () => {
    const payload = {
      data: {
        attestations: [
          {
            id: "0xUID",
            attester: "0xabc",
            time: 1700000000,
            revoked: false,
            data: encodeComment(fields),
          },
        ],
      },
    };
    const out = await fetchComments("0xSCHEMA", { fetchImpl: fakeFetch(payload) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      uid: "0xUID",
      attester: "0xabc",
      time: 1700000000,
      blockId: "02-p7",
      spanExact: "walkaway",
      body: "なるほど。",
    });
  });

  it("returns [] when there are no attestations", async () => {
    const out = await fetchComments("0xSCHEMA", {
      fetchImpl: fakeFetch({ data: { attestations: [] } }),
    });
    expect(out).toEqual([]);
  });
});
