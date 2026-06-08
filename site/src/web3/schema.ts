import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA } from "./constants";

export interface CommentFields {
  chapter: string;
  blockId: string;
  lang: string;
  sourceId: string;
  blockHash: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  spanPrefix: string;
  spanSuffix: string;
  contributionType: string;
  parentUid: string;
  body: string;
}

const encoder = () => new SchemaEncoder(SCHEMA);

export function encodeComment(f: CommentFields): string {
  return encoder().encodeData([
    { name: "chapter", value: f.chapter, type: "string" },
    { name: "blockId", value: f.blockId, type: "string" },
    { name: "lang", value: f.lang, type: "string" },
    { name: "sourceId", value: f.sourceId, type: "bytes32" },
    { name: "blockHash", value: f.blockHash, type: "bytes32" },
    { name: "spanStart", value: f.spanStart, type: "uint32" },
    { name: "spanEnd", value: f.spanEnd, type: "uint32" },
    { name: "spanExact", value: f.spanExact, type: "string" },
    { name: "spanPrefix", value: f.spanPrefix, type: "string" },
    { name: "spanSuffix", value: f.spanSuffix, type: "string" },
    { name: "contributionType", value: f.contributionType, type: "string" },
    { name: "parentUid", value: f.parentUid, type: "bytes32" },
    { name: "body", value: f.body, type: "string" },
  ]);
}

export function decodeComment(data: string): CommentFields {
  const items = encoder().decodeData(data);
  const get = (name: string) => items.find((i) => i.name === name)?.value.value;
  return {
    chapter: String(get("chapter")),
    blockId: String(get("blockId")),
    lang: String(get("lang")),
    sourceId: String(get("sourceId")),
    blockHash: String(get("blockHash")),
    spanStart: Number(get("spanStart")),
    spanEnd: Number(get("spanEnd")),
    spanExact: String(get("spanExact")),
    spanPrefix: String(get("spanPrefix")),
    spanSuffix: String(get("spanSuffix")),
    contributionType: String(get("contributionType")),
    parentUid: String(get("parentUid")),
    body: String(get("body")),
  };
}
