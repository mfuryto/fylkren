import { describe, expect, it } from "vitest";
import { normalizeLanguage, translate } from ".";

describe("localization catalogs", () => {
  it("uses English for unknown and unsupported languages", () => {
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(translate("fr-FR", "regionalTitle")).toBe("Language and regional settings");
  });

  it("keeps Norwegian in its dedicated language pack", () => {
    expect(normalizeLanguage("nb-NO")).toBe("nb-NO");
    expect(translate("nb-NO", "regionalTitle")).not.toBe("Language and regional settings");
  });
});
