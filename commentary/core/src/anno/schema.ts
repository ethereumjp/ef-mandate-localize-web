import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ANNO_SCHEMA } from "./constants";
import { annoFieldDefs } from "./encode-defs";

export interface AnnoFields {
  url: string;
  urlCanonical: string;
  origin: string;
  lang: string;
  rootSelector: string;
  containerHash: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  spanPrefix: string;
  spanSuffix: string;
  parentUid: string;
  body: string;
  meta: string;
}

const encoder = () => new SchemaEncoder(ANNO_SCHEMA);

export function encodeAnno(f: AnnoFields): string {
  return encoder().encodeData(annoFieldDefs(f));
}

export function decodeAnno(data: string): AnnoFields {
  const items = encoder().decodeData(data);
  const get = (name: string) => items.find((i) => i.name === name)?.value.value;
  return {
    url: String(get("url")),
    urlCanonical: String(get("urlCanonical")),
    origin: String(get("origin")),
    lang: String(get("lang")),
    rootSelector: String(get("rootSelector")),
    containerHash: String(get("containerHash")),
    spanStart: Number(get("spanStart")),
    spanEnd: Number(get("spanEnd")),
    spanExact: String(get("spanExact")),
    spanPrefix: String(get("spanPrefix")),
    spanSuffix: String(get("spanSuffix")),
    parentUid: String(get("parentUid")),
    body: String(get("body")),
    meta: String(get("meta")),
  };
}
