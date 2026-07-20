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
