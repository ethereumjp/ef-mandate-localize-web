import { keccak256, stringToBytes, slice, getAddress } from "viem";

/**
 * EAS `recipient` page bucket: the first 20 bytes of keccak256(utf8(urlCanonical)),
 * checksummed to an address. Used as the indexed server-side page filter. MUST be
 * fed `urlCanonical` (not a raw URL) so two authors on the same page agree.
 */
export function pageKey(urlCanonical: string): `0x${string}` {
  return getAddress(slice(keccak256(stringToBytes(urlCanonical)), 0, 20));
}
