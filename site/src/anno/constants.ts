/**
 * The generalized any-site comment schema (spec 2026-06-11).
 * Register once on EAS; the resulting UID is the schema version.
 */
export const ANNO_SCHEMA =
  "string url,string urlCanonical,string origin,string lang,string rootSelector,bytes32 containerHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,bytes32 parentUid,string body,string meta";
