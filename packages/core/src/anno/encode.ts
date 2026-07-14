import { encodeAbiParameters } from "viem";
import { ANNO_ABI } from "./encode-defs";
import type { AnnoFields } from "./schema";

/**
 * Encode `AnnoFields` into EAS attestation data (ABI-encoded per `ANNO_SCHEMA`).
 * Uses viem with the same `ANNO_ABI` descriptors as `decodeAnno`, so encode and
 * decode share one source of truth and neither path needs the EAS SDK.
 */
export function encodeAnno(f: AnnoFields): `0x${string}` {
  return encodeAbiParameters(ANNO_ABI, [
    f.url,
    f.urlCanonical,
    f.origin,
    f.lang,
    f.rootSelector,
    f.containerHash,
    f.spanStart,
    f.spanEnd,
    f.spanExact,
    f.spanPrefix,
    f.spanSuffix,
    f.body,
    f.meta,
  ]);
}
