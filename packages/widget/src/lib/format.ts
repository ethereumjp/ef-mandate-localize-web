/** Shorten a 0x address/hash for display: `0x1234…abcd`. */
export const shortHex = (h: string): string =>
  h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
