import type { AnnoFields } from "./schema";

/**
 * Ordered field descriptors (name + ABI type) for an `AnnoFields`, matching
 * `ANNO_SCHEMA`. Shared by the viem decoder (`anno/schema.ts` `decodeAnno`) and
 * the eas-sdk encoder (`anno/encode.ts` `encodeAnno`). SDK-free, so the read path
 * (decode) never pulls in the EAS SDK.
 */
export const ANNO_ABI = [
  { name: "url", type: "string" },
  { name: "urlCanonical", type: "string" },
  { name: "origin", type: "string" },
  { name: "lang", type: "string" },
  { name: "rootSelector", type: "string" },
  { name: "containerHash", type: "bytes32" },
  { name: "spanStart", type: "uint32" },
  { name: "spanEnd", type: "uint32" },
  { name: "spanExact", type: "string" },
  { name: "spanPrefix", type: "string" },
  { name: "spanSuffix", type: "string" },
  { name: "parentUid", type: "bytes32" },
  { name: "body", type: "string" },
  { name: "meta", type: "string" },
] as const;

/** The ordered EAS field descriptors *with values*, for `encodeAnno` (eas-sdk). */
export function annoFieldDefs(
  f: AnnoFields,
): { name: string; type: string; value: string | number }[] {
  return ANNO_ABI.map((p) => ({
    name: p.name,
    type: p.type,
    value: f[p.name as keyof AnnoFields],
  }));
}
