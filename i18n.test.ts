import { describe, it, expect } from "vitest";
import { resolveLanguage, catalogs, languages } from "./i18n";
import { english } from "./translations";
describe("language selection", () => {
  it("defaults unsupported and legacy automatic settings to English", () => {
    for (const value of ["", "auto", "unsupported"])
      expect(resolveLanguage(value)).toBe("en");
    for (const value of Object.keys(languages))
      expect(resolveLanguage(value)).toBe(value);
  });
  it("has a nonempty value for every label in every catalog", () => {
    for (const dictionary of Object.values(catalogs)) {
      expect(Object.keys(dictionary).sort()).toEqual(
        Object.keys(english).sort(),
      );
      for (const value of Object.values(dictionary))
        expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
