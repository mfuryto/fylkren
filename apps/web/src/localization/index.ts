import { en, type MessageKey } from "./en";
import { nbNO } from "./nb-NO";

export const supportedLanguages = ["en", "nb-NO"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export function normalizeLanguage(value: string): SupportedLanguage {
  const normalized = value.toLowerCase();
  return normalized.startsWith("nb") || normalized.startsWith("no") ? "nb-NO" : "en";
}

export type MessageVariables = Record<string, string | number>;
let activeLanguage: SupportedLanguage = "en";

export function setActiveLanguage(language: string) {
  activeLanguage = normalizeLanguage(language);
}

export function translate(language: string, key: MessageKey, variables: MessageVariables = {}): string {
  const message = normalizeLanguage(language) === "nb-NO" ? nbNO[key] ?? en[key] : en[key];
  return message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : match);
}

export function translateActive(key: MessageKey, variables: MessageVariables = {}) {
  return translate(activeLanguage, key, variables);
}
