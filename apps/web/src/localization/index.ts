import { en, type MessageKey } from "./catalogs/en-US";
import { enGB } from "./catalogs/en-GB";
import { nbNO } from "./catalogs/nb-NO";

export type { MessageKey } from "./catalogs/en-US";

export const supportedLanguages = ["en-US", "en-GB", "nb-NO"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const languageCatalogs: Record<SupportedLanguage, Record<MessageKey, string>> = {
  "en-GB": enGB,
  "en-US": en,
  "nb-NO": nbNO,
};

export function normalizeLanguage(value: string): SupportedLanguage {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("nb") || normalized.startsWith("no")) return "nb-NO";
  if (normalized.startsWith("en-gb")) return "en-GB";
  return "en-US";
}

export type MessageVariables = Record<string, string | number>;
export type ClockFormat = "12-hour" | "24-hour";
let activeLanguage: SupportedLanguage = "en-US";

export function regionalDisplayLocale(language: string, clockFormat: ClockFormat): string {
  return new Intl.Locale(normalizeLanguage(language), {
    hourCycle: clockFormat === "12-hour" ? "h12" : "h23",
  }).toString();
}

export function setActiveLanguage(language: string) {
  activeLanguage = normalizeLanguage(language);
}

export function translate(language: string, key: MessageKey, variables: MessageVariables = {}): string {
  const message = languageCatalogs[normalizeLanguage(language)][key] ?? en[key];
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : match);
}

export function translateActive(key: MessageKey, variables: MessageVariables = {}) {
  return translate(activeLanguage, key, variables);
}

export function compareActiveLanguage(left: string, right: string) {
  return left.localeCompare(right, activeLanguage, { sensitivity: "base" });
}
