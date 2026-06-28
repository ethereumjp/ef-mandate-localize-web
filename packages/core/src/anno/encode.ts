import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ANNO_SCHEMA } from "./constants";
import { annoFieldDefs } from "./encode-defs";
import type { AnnoFields } from "./schema";

/**
 * Encode `AnnoFields` into EAS attestation data. Write path only — uses the
 * eas-sdk `SchemaEncoder`, so it is imported solely by the heavy app/wallet chunk,
 * never by the light read/display path (`decodeAnno` lives in `anno/schema.ts`).
 */
export function encodeAnno(f: AnnoFields): string {
  return new SchemaEncoder(ANNO_SCHEMA).encodeData(annoFieldDefs(f));
}
