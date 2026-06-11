import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ANNO_SCHEMA } from "./constants";

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
  return encoder().encodeData([
    { name: "url", value: f.url, type: "string" },
    { name: "urlCanonical", value: f.urlCanonical, type: "string" },
    { name: "origin", value: f.origin, type: "string" },
    { name: "lang", value: f.lang, type: "string" },
    { name: "rootSelector", value: f.rootSelector, type: "string" },
    { name: "containerHash", value: f.containerHash, type: "bytes32" },
    { name: "spanStart", value: f.spanStart, type: "uint32" },
    { name: "spanEnd", value: f.spanEnd, type: "uint32" },
    { name: "spanExact", value: f.spanExact, type: "string" },
    { name: "spanPrefix", value: f.spanPrefix, type: "string" },
    { name: "spanSuffix", value: f.spanSuffix, type: "string" },
    { name: "parentUid", value: f.parentUid, type: "bytes32" },
    { name: "body", value: f.body, type: "string" },
    { name: "meta", value: f.meta, type: "string" },
  ]);
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
