import { en, type MessageKey } from "./en";
import { nbNO } from "./nb-NO";

export const supportedLanguages = ["en", "nb-NO"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export function normalizeLanguage(value: string): SupportedLanguage {
  const normalized = value.toLowerCase();
  return normalized.startsWith("nb") || normalized.startsWith("no") ? "nb-NO" : "en";
}

export function translate(language: string, key: MessageKey): string {
  return normalizeLanguage(language) === "nb-NO" ? nbNO[key] ?? en[key] : en[key];
}
