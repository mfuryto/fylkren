import { describe, expect, it } from "vitest";
import { languageCatalogs, normalizeLanguage, regionalDisplayLocale, supportedLanguages, translate } from ".";
import { en } from "./en";

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

  it("requires every registered language pack to match source keys and placeholders", () => {
    const sourceKeys = Object.keys(en).sort();
    const placeholders = (message: string) => [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match => match[1]).sort();
    for (const language of supportedLanguages) {
      expect(Object.keys(languageCatalogs[language]).sort()).toEqual(sourceKeys);
      for (const key of sourceKeys) {
        expect(placeholders(languageCatalogs[language][key as keyof typeof en])).toEqual(placeholders(en[key as keyof typeof en]));
      }
    }
  });
});
