import type { AnnoFields } from "./schema";

/**
 * Ordered field descriptors (name + ABI type) for an `AnnoFields`, matching
 * `ANNO_SCHEMA`. Shared by the viem decoder (`anno/schema.ts` `decodeAnno`) and
 * the viem encoder (`anno/encode.ts` `encodeAnno`).
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
  { name: "body", type: "string" },
  { name: "meta", type: "string" },
] as const satisfies readonly { name: keyof AnnoFields; type: string }[];
