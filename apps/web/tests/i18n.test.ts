import { describe, it, expect } from "vitest";
import { langRoute, resolveMessage, t } from "../src/lib/i18n";

describe("langRoute", () => {
  it("maps the source language to /", () => {
    expect(langRoute("en")).toBe("/");
  });
  it("maps other languages to /<code>", () => {
    expect(langRoute("ja")).toBe("/ja");
  });
});

describe("resolveMessage", () => {
  const table = { en: { a: "A", b: "B" }, fr: { a: "Af" } };
  it("returns the language's value when present", () => {
    expect(resolveMessage(table, "en", "fr", "a")).toBe("Af");
  });
  it("falls back to the fallback language when the key is missing", () => {
    expect(resolveMessage(table, "en", "fr", "b")).toBe("B");
  });
  it("falls back when the language is absent entirely", () => {
    expect(resolveMessage(table, "en", "de", "a")).toBe("A");
  });
});

describe("t", () => {
  it("returns the translated UI string, falling back to source", () => {
    expect(t("ja", "index")).toBe("目次");
    expect(t("en", "index")).toBe("Chapters");
  });
});
