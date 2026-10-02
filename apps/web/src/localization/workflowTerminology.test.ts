import { describe, expect, it } from "vitest";
import { languageCatalogs, supportedLanguages, translate } from ".";

describe("operational workflow terminology", () => {
  it("keeps carrying out tasks distinct from capital punishment throughout catalogs", () => {
    for (const locale of ["da-DK", "fi-FI", "et-EE"] as const) {
      for (const [key, message] of Object.entries(languageCatalogs[locale])) {
        expect(message, `${locale}.${key}`).not.toMatch(/(?<!\p{L})(?:henrett|teloit|hukkami)/iu);
      }
    }
  });

  it("preserves paused, cancelled, withdrawn and reassigned states", () => {
    const reviewed = {
      "sv-SE": ["Vilande", "Avbruten", "\u00c5terkallad av avsändaren", "Omtilldelad"],
      "uk-UA": ["Призупинено", "Скасовано", "Відкликано відправником", "Перепризначено"],
      "lt-LT": ["Sustabdyta", "Atšaukta", "Siuntėjo atšaukta", "Priskirta iš naujo"],
      "cs-CZ": ["Pozastaveno", "Zrušeno", "Staženo odesílatelem", "Přiděleno znovu"],
    };
    const keys = ["taskStatusOnHold", "taskStatusCancelled", "taskStatusRequestCancelled", "taskStatusReassigned"] as const;
    for (const [locale, values] of Object.entries(reviewed)) {
      keys.forEach((key, index) => expect(translate(locale, key)).toBe(values[index]));
    }
  });

  it("uses the same state meaning in overview counters and task cards", () => {
    for (const locale of supportedLanguages.filter(locale => !locale.startsWith("en-"))) {
      const catalog = languageCatalogs[locale];
      for (const [key, value] of Object.entries(catalog)) {
        if (!key.startsWith("overviewStatus")) continue;
        const taskKey = key.replace("overviewStatus", "taskStatus") as keyof typeof catalog;
        if (taskKey in catalog) expect(value, `${locale}.${key}`).toBe(catalog[taskKey]);
      }
    }
  });

  it("uses task deadlines rather than payment, event or expiry dates", () => {
    expect(translate("pl-PL", "tasksTaskCardPresentationDueDate")).toBe("Termin wykonania:");
    expect(translate("uk-UA", "tasksTaskCardPresentationDueDate")).toBe("Кінцевий термін:");
    expect(translate("nl-NL", "tasksTaskCardPresentationDueDate")).toBe("Uiterste datum:");
    expect(translate("sv-SE", "tasksTaskCardPresentationDueDate")).toBe("Förfallodatum:");
  });
});
