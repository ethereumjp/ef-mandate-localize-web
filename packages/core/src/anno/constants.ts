import { encodePacked, keccak256 } from "viem";
import { ANNO_ABI } from "./encode-defs";

/**
 * The generalized any-site comment schema (spec 2026-06-11), derived from
 * `ANNO_ABI` so the ABI and the registered schema string cannot drift.
 * BYTE-STABLE: the EAS schema UID is keccak256 over this exact string —
 * see the golden test in tests/anno.schema.test.ts.
 */
export const ANNO_SCHEMA = ANNO_ABI.map((p) => `${p.type} ${p.name}`).join(",");

/** EAS empty reference UID (top-level comments; matches on-chain EMPTY_UID). */
export const EMPTY_UID = "0x" + "00".repeat(32);

/** Registration params — inputs to the UID, so they live next to the schema. */
export const ANNO_RESOLVER = "0x0000000000000000000000000000000000000000" as const;
export const ANNO_REVOCABLE = true;

/** EAS SchemaRegistry UID: keccak256(abi.encodePacked(schema, resolver, revocable)). */
export function deriveSchemaUid(
  schema: string,
  resolver: `0x${string}`,
  revocable: boolean,
): `0x${string}` {
  return keccak256(encodePacked(["string", "address", "bool"], [schema, resolver, revocable]));
}

/**
 * The canonical anno schema UID — deterministic and chain-independent, so it is
 * derived here once and shipped as the widget's default. Registration on a
 * chain (apps/web `anno:schema:register`) is still required before attesting.
 */
export const ANNO_SCHEMA_UID = deriveSchemaUid(ANNO_SCHEMA, ANNO_RESOLVER, ANNO_REVOCABLE);
