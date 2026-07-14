import { decodeAnno } from "./schema";
import type { StoredAnno } from "./locate";
import { DEFAULT_NETWORK, NETWORKS } from "../chain";

/** GraphQL query; scoped by `recipient` (the page key) when one is supplied. */
function buildQuery(scoped: boolean): string {
  return `query Comments($schemaId: String!${scoped ? ", $recipient: String!" : ""}) {
  attestations(
    where: { schemaId: { equals: $schemaId }, revoked: { equals: false }${
      scoped ? ", recipient: { equals: $recipient }" : ""
    } }
    orderBy: { time: asc }
  ) { id attester time revoked refUID data }
}`;
}

export interface RawAttestation {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  refUID: string;
  data: string;
}

/** Map a raw EAS attestation (GraphQL shape) to a decoded StoredAnno. Shared by
 *  `fetchAnno` and the dev mock so both decode identically. */
export function decodeAttestation(a: RawAttestation): StoredAnno {
  return {
    uid: a.id,
    attester: a.attester,
    time: Number(a.time),
    refUID: a.refUID,
    ...decodeAnno(a.data),
  };
}

/** Fetch + decode non-revoked anno attestations, scoped to a page when `pageKey` is set. */
export async function fetchAnno(
  schemaUid: string,
  opts: { pageKey?: string; endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<StoredAnno[]> {
  if (!schemaUid) return [];
  const f = opts.fetchImpl ?? fetch;
  const scoped = Boolean(opts.pageKey);
  const variables = scoped
    ? { schemaId: schemaUid, recipient: opts.pageKey }
    : { schemaId: schemaUid };
  const res = await f(opts.endpoint ?? NETWORKS[DEFAULT_NETWORK].graphql, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: buildQuery(scoped), variables }),
  });
  if (!res.ok) throw new Error(`EAS GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: { attestations?: RawAttestation[] };
    errors?: { message?: string }[];
  };
  if (json.errors?.length) {
    const msgs = json.errors.map((e) => e.message ?? "unknown error").join("; ");
    throw new Error(`EAS GraphQL: ${msgs}`);
  }
  const rows = json.data?.attestations ?? [];
  return rows.map(decodeAttestation);
}
