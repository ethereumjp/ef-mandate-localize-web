import { keccak256, stringToBytes } from "viem";
import { normalizeBlockText } from "./normalize";

/** keccak256 of the UTF-8 bytes of already-normalized text. */
export function blockHashFromNormalized(normalized: string): `0x${string}` {
  return keccak256(stringToBytes(normalized));
}

/** Normalize raw block source, then hash. */
export function blockHash(blockSource: string): `0x${string}` {
  return blockHashFromNormalized(normalizeBlockText(blockSource));
}
