import { decodeComment, type CommentFields } from "./schema";

export interface StoredComment extends CommentFields {
  uid: string;
  attester: string;
  time: number; // unix seconds
}

const EAS_GRAPHQL = "https://sepolia.easscan.org/graphql";

const QUERY = `query Comments($schemaId: String!) {
  attestations(
    where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
    orderBy: { time: asc }
  ) { id attester time revoked data }
}`;

interface RawAttestation {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  data: string;
}

/** Fetch + decode all non-revoked comment attestations for a schema. */
export async function fetchComments(
  schemaUid: string,
  opts: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<StoredComment[]> {
  if (!schemaUid) return [];
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.endpoint ?? EAS_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { schemaId: schemaUid } }),
  });
  if (!res.ok) throw new Error(`EAS GraphQL ${res.status}`);
  const json = (await res.json()) as { data?: { attestations?: RawAttestation[] } };
  const rows = json.data?.attestations ?? [];
  return rows.map((a) => ({
    uid: a.id,
    attester: a.attester,
    time: Number(a.time),
    ...decodeComment(a.data),
  }));
}
