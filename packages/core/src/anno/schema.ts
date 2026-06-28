import { decodeAbiParameters } from "viem";
import { ANNO_ABI } from "./encode-defs";

export interface AnnoFields {
  url: string;
  urlCanonical: string;
  origin: string;
  lang: string;
  rootSelector: string;
  containerHash: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  spanPrefix: string;
  spanSuffix: string;
  body: string;
  meta: string;
}

/**
 * Decode EAS attestation data (ABI-encoded per `ANNO_SCHEMA`) into `AnnoFields`.
 * Uses viem's ABI decoder rather than the eas-sdk `SchemaEncoder`, so the read
 * path (Stage 1 of the embed) stays free of eas-sdk/ethers. The write path
 * (`encodeAnno` in `anno/encode.ts`) keeps eas-sdk.
 */
export function decodeAnno(data: string): AnnoFields {
  const v = decodeAbiParameters(ANNO_ABI, data as `0x${string}`);
  return {
    url: v[0],
    urlCanonical: v[1],
    origin: v[2],
    lang: v[3],
    rootSelector: v[4],
    containerHash: v[5],
    spanStart: Number(v[6]),
    spanEnd: Number(v[7]),
    spanExact: v[8],
    spanPrefix: v[9],
    spanSuffix: v[10],
    body: v[11],
    meta: v[12],
  };
}
