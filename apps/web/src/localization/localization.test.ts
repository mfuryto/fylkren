import { describe, expect, it } from "vitest";
import { languageCatalogs, normalizeLanguage, regionalDisplayLocale, supportedLanguages, translate } from ".";
import { en } from "./catalogs/en-US";

describe("localization catalogs", () => {
  it("uses English for unknown and unsupported languages", () => {
    expect(normalizeLanguage("ja-JP")).toBe("en-US");
    expect(normalizeLanguage("pt-BR")).toBe("en-US");
    expect(normalizeLanguage("fr-CA")).toBe("en-US");
    expect(normalizeLanguage("es-MX")).toBe("en-US");
    expect(translate("ja-JP", "regionalTitle")).toBe("Language and regional settings");
  });

  it("keeps British and American English as distinct complete variants", () => {
    expect(normalizeLanguage("en")).toBe("en-US");
    expect(normalizeLanguage("en-US")).toBe("en-US");
    expect(normalizeLanguage("en-GB")).toBe("en-GB");
    expect(translate("en-US", "colors")).toBe("Colors");
    expect(translate("en-GB", "colors")).toBe("Colours");
    expect(translate("en-US", "navOrganization")).toBe("Organization");
    expect(translate("en-GB", "navOrganization")).toBe("Organisation");
    expect(translate("en-US", "siteCatalogueUpdated")).toBe("The site catalog was updated.");
    expect(translate("en-GB", "siteCatalogueUpdated")).toBe("The site catalogue was updated.");
    expect(translate("en-US", "workflowsPlanningRfiLogNoInquiriesAreRegistered")).toBe("No inquiries are registered.");
    expect(translate("en-GB", "workflowsPlanningRfiLogNoInquiriesAreRegistered")).toBe("No enquiries are registered.");
    expect(translate("en-US", "taskStatusCancelled")).toBe("Canceled");
    expect(translate("en-GB", "taskStatusCancelled")).toBe("Cancelled");
  });

  it("keeps Norwegian in its dedicated language pack", () => {
    expect(normalizeLanguage("nb-NO")).toBe("nb-NO");
    expect(translate("nb-NO", "regionalTitle")).not.toBe("Language and regional settings");
  });

  it("normalizes every bundled language and its bare language code", () => {
    const expected = {
      sv: "sv-SE", da: "da-DK", fi: "fi-FI", de: "de-DE", fr: "fr-FR", pl: "pl-PL", es: "es-ES", it: "it-IT",
      uk: "uk-UA", nl: "nl-NL", pt: "pt-PT", cs: "cs-CZ", ro: "ro-RO", et: "et-EE", lv: "lv-LV", lt: "lt-LT",
    } as const;
    for (const [language, locale] of Object.entries(expected)) {
      expect(normalizeLanguage(language)).toBe(locale);
      expect(normalizeLanguage(locale)).toBe(locale);
    }
  });

  it("enforces the configured clock format independently of the language", () => {
    const instant = new Date("2026-10-01T18:30:00Z");
    const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: "UTC" };
    const twelveHour = new Intl.DateTimeFormat(regionalDisplayLocale("en-US", "12-hour"), options).format(instant);
    const twentyFourHour = new Intl.DateTimeFormat(regionalDisplayLocale("en-US", "24-hour"), options).format(instant);
    expect(twelveHour).toMatch(/PM/i);
    expect(twentyFourHour).toContain("18:30");
    expect(twentyFourHour).not.toMatch(/AM|PM/i);
  });

  it("provides working date, number, plural and sorting behavior for every locale", () => {
    const instant = new Date("2026-10-01T18:30:00Z");
    for (const language of supportedLanguages) {
      const locale = regionalDisplayLocale(language, "24-hour");
      expect(new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(instant)).not.toHaveLength(0);
      expect(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(1234.5)).not.toHaveLength(0);
      expect(new Intl.PluralRules(locale).select(2)).toMatch(/^(zero|one|two|few|many|other)$/);
      expect(new Intl.Collator(locale, { sensitivity: "base" }).compare("a", "b")).toBeLessThan(0);
    }
  });

  it("shows every language by its native name", () => {
    const nativeNames = {
      languageNorwegian: "Norsk bokmål", languageSwedish: "Svenska", languageDanish: "Dansk", languageFinnish: "Suomi",
      languageGerman: "Deutsch", languageFrench: "Français", languagePolish: "Polski", languageSpanish: "Español (España)",
      languageItalian: "Italiano", languageUkrainian: "Українська", languageDutch: "Nederlands", languagePortuguese: "Português (Portugal)",
      languageCzech: "Čeština", languageRomanian: "Română", languageEstonian: "Eesti", languageLatvian: "Latviešu", languageLithuanian: "Lietuvių",
    } as const;
    for (const language of supportedLanguages) {
      for (const [key, value] of Object.entries(nativeNames)) expect(translate(language, key as keyof typeof en)).toBe(value);
    }
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
