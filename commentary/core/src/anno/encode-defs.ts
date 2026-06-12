import type { AnnoFields } from "./schema";

/**
 * The ordered EAS field descriptors for an `AnnoFields`. Shared by `encodeAnno`
 * (anno/schema.ts) and the `gen-mock-comments` script. Kept SDK-free so it can be
 * imported in any runtime: the two callers build the `SchemaEncoder` differently
 * (Vite/vitest use the named import; the Node gen script uses the default import,
 * because the EAS SDK's ESM/CJS exports differ per loader).
 */
export function annoFieldDefs(
  f: AnnoFields,
): { name: string; type: string; value: string | number }[] {
  return [
    { name: "url", type: "string", value: f.url },
    { name: "urlCanonical", type: "string", value: f.urlCanonical },
    { name: "origin", type: "string", value: f.origin },
    { name: "lang", type: "string", value: f.lang },
    { name: "rootSelector", type: "string", value: f.rootSelector },
    { name: "containerHash", type: "bytes32", value: f.containerHash },
    { name: "spanStart", type: "uint32", value: f.spanStart },
    { name: "spanEnd", type: "uint32", value: f.spanEnd },
    { name: "spanExact", type: "string", value: f.spanExact },
    { name: "spanPrefix", type: "string", value: f.spanPrefix },
    { name: "spanSuffix", type: "string", value: f.spanSuffix },
    { name: "parentUid", type: "bytes32", value: f.parentUid },
    { name: "body", type: "string", value: f.body },
    { name: "meta", type: "string", value: f.meta },
  ];
}
