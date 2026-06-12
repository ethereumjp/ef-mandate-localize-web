// Dev-only mock comments. Enabled by PUBLIC_MOCK_COMMENTS=1 (`pnpm run dev:mock`).
// Loads a captured EAS GraphQL response (./mock-comments.json — regenerate with
// `pnpm gen:mock`, see scripts/gen-mock-comments.ts) and decodes it EXACTLY like
// `fetchAnno`. `urlCanonical` is stored path-relative; we rebind it to the running
// origin so the fixture works on any dev port. Never used unless the flag is set.
import rawAttestations from "./mock-comments.json";
import { decodeAttestation, type RawAttestation } from "./read";
import { canonicalizeUrl } from "./canonicalUrl";
import type { StoredAnno } from "./locate";

/** Decode the bundled mock attestations, rebinding their URLs to this origin. */
export function loadMockComments(): StoredAnno[] {
  return (rawAttestations as RawAttestation[]).map((a) => {
    const c = decodeAttestation(a);
    const { url, urlCanonical, origin } = canonicalizeUrl(
      new URL(c.urlCanonical, location.origin).href,
    );
    return { ...c, url, urlCanonical, origin };
  });
}
