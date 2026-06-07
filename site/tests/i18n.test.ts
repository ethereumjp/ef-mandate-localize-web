import { describe, it, expect } from "vitest";
import { MESSAGES, LANGS } from "../src/lib/i18n";

describe("i18n", () => {
  it("LANGS is en, ja", () => {
    expect(LANGS).toEqual(["en", "ja"]);
  });
  it("en and ja have identical key sets", () => {
    expect(Object.keys(MESSAGES.ja).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });
  it("has no empty strings", () => {
    for (const lang of LANGS) {
      for (const [k, v] of Object.entries(MESSAGES[lang])) {
        expect(v, `${lang}.${k}`).not.toBe("");
      }
    }
  });
});
