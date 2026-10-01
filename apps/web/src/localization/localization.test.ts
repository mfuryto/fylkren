import { describe, expect, it } from "vitest";
import { normalizeLanguage, regionalDisplayLocale, translate } from ".";

describe("localization catalogs", () => {
  it("uses English for unknown and unsupported languages", () => {
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(translate("fr-FR", "regionalTitle")).toBe("Language and regional settings");
  });

  it("keeps Norwegian in its dedicated language pack", () => {
    expect(normalizeLanguage("nb-NO")).toBe("nb-NO");
    expect(translate("nb-NO", "regionalTitle")).not.toBe("Language and regional settings");
  });

  it("enforces the configured clock format independently of the language", () => {
    const instant = new Date("2026-10-01T18:30:00Z");
    const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: "UTC" };
    const twelveHour = new Intl.DateTimeFormat(regionalDisplayLocale("en", "12-hour"), options).format(instant);
    const twentyFourHour = new Intl.DateTimeFormat(regionalDisplayLocale("en", "24-hour"), options).format(instant);
    expect(twelveHour).toMatch(/PM/i);
    expect(twentyFourHour).toContain("18:30");
    expect(twentyFourHour).not.toMatch(/AM|PM/i);
  });
});
