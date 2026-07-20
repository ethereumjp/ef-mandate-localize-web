import { decodeAbiParameters } from "viem";
import { ANNO_ABI } from "./encode-defs";

export interface AnnoFields {
  url: string;
  urlCanonical: string;
  origin: string;
  lang: string;
  rootSelector: string;
  containerHash: `0x${string}`;
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
 * Uses viem's ABI decoder, so `@anno/core` stays free of the eas-sdk entirely —
 * `encodeAnno` (`anno/encode.ts`) also uses viem, sharing `ANNO_ABI`.
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
