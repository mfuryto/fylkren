import { en, type MessageKey } from "./catalogs/en-US";
import { enGB } from "./catalogs/en-GB";
import { nbNO } from "./catalogs/nb-NO";
import { svSE } from "./catalogs/sv-SE";
import { daDK } from "./catalogs/da-DK";
import { fiFI } from "./catalogs/fi-FI";
import { deDE } from "./catalogs/de-DE";
import { frFR } from "./catalogs/fr-FR";
import { plPL } from "./catalogs/pl-PL";
import { esES } from "./catalogs/es-ES";
import { itIT } from "./catalogs/it-IT";
import { ukUA } from "./catalogs/uk-UA";
import { nlNL } from "./catalogs/nl-NL";
import { ptPT } from "./catalogs/pt-PT";
import { csCZ } from "./catalogs/cs-CZ";
import { roRO } from "./catalogs/ro-RO";
import { etEE } from "./catalogs/et-EE";
import { lvLV } from "./catalogs/lv-LV";
import { ltLT } from "./catalogs/lt-LT";
import { normalizeReservedTerms } from "./reservedTerms";

export type { MessageKey } from "./catalogs/en-US";

export const supportedLanguages = ["en-US", "en-GB", "nb-NO", "sv-SE", "da-DK", "fi-FI", "de-DE", "fr-FR", "pl-PL", "es-ES", "it-IT", "uk-UA", "nl-NL", "pt-PT", "cs-CZ", "ro-RO", "et-EE", "lv-LV", "lt-LT"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const languageCatalogs: Record<SupportedLanguage, Record<MessageKey, string>> = {
  "en-GB": normalizeReservedTerms("en-GB", en, enGB),
  "en-US": normalizeReservedTerms("en-US", en, en),
  "nb-NO": normalizeReservedTerms("nb-NO", en, nbNO),
  "sv-SE": normalizeReservedTerms("sv-SE", en, svSE),
  "da-DK": normalizeReservedTerms("da-DK", en, daDK),
  "fi-FI": normalizeReservedTerms("fi-FI", en, fiFI),
  "de-DE": normalizeReservedTerms("de-DE", en, deDE),
  "fr-FR": normalizeReservedTerms("fr-FR", en, frFR),
  "pl-PL": normalizeReservedTerms("pl-PL", en, plPL),
  "es-ES": normalizeReservedTerms("es-ES", en, esES),
  "it-IT": normalizeReservedTerms("it-IT", en, itIT),
  "uk-UA": normalizeReservedTerms("uk-UA", en, ukUA),
  "nl-NL": normalizeReservedTerms("nl-NL", en, nlNL),
  "pt-PT": normalizeReservedTerms("pt-PT", en, ptPT),
  "cs-CZ": normalizeReservedTerms("cs-CZ", en, csCZ),
  "ro-RO": normalizeReservedTerms("ro-RO", en, roRO),
  "et-EE": normalizeReservedTerms("et-EE", en, etEE),
  "lv-LV": normalizeReservedTerms("lv-LV", en, lvLV),
  "lt-LT": normalizeReservedTerms("lt-LT", en, ltLT),
};

const normalizedLanguages: Record<string, SupportedLanguage> = {
  sv: "sv-SE", "sv-se": "sv-SE", da: "da-DK", "da-dk": "da-DK", fi: "fi-FI", "fi-fi": "fi-FI",
  de: "de-DE", "de-de": "de-DE", fr: "fr-FR", "fr-fr": "fr-FR", pl: "pl-PL", "pl-pl": "pl-PL",
  es: "es-ES", "es-es": "es-ES", it: "it-IT", "it-it": "it-IT", uk: "uk-UA", "uk-ua": "uk-UA",
  nl: "nl-NL", "nl-nl": "nl-NL", pt: "pt-PT", "pt-pt": "pt-PT", cs: "cs-CZ", "cs-cz": "cs-CZ",
  ro: "ro-RO", "ro-ro": "ro-RO", et: "et-EE", "et-ee": "et-EE", lv: "lv-LV", "lv-lv": "lv-LV",
  lt: "lt-LT", "lt-lt": "lt-LT",
};

export function normalizeLanguage(value: string): SupportedLanguage {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("nb") || normalized.startsWith("no")) return "nb-NO";
  if (normalized.startsWith("en-gb")) return "en-GB";
  if (normalizedLanguages[normalized]) return normalizedLanguages[normalized];
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
