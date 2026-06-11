// Deterministic page-URL canonicalization. MUST be stable across clients:
// two authors on the same page must produce the same `urlCanonical`, or the
// per-page join key splits. Keep this function versioned and well-tested.

/** Query params dropped during canonicalization (tracking noise, denylist). */
export const TRACKING_PARAMS: readonly string[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_eid",
  "mc_cid",
  "igshid",
  "ref",
  "ref_src",
];

export interface CanonicalUrl {
  /** The raw input URL, untouched (provenance / SPA fallback). */
  url: string;
  /** The canonical form used as the per-page join key. */
  urlCanonical: string;
  /** scheme://host[:port] — the site scope. */
  origin: string;
}

export function canonicalizeUrl(input: string): CanonicalUrl {
  const u = new URL(input); // host lowercased, default port dropped by URL
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.searchParams.sort(); // stable param order
  u.hash = ""; // drop fragment (SPA hash routing handled per-site later)
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return { url: input, urlCanonical: u.toString(), origin: u.origin };
}
