import type { MessageKey } from "./catalogs/en-US";

type Catalog = Record<MessageKey, string>;

const protectedSegment = /\{[A-Za-z][A-Za-z0-9]*\}|\/[^\s,.;)]+|\bSite Managers?\b/g;

const siteForms: Record<string, RegExp> = {
  "en-US": /\bsites?\b/giu,
  "en-GB": /\bsites?\b/giu,
  "nb-NO": /\b(?:nettsted(?:et|ets|er|ene|enes)?|site(?:n|ns|r|ne|nes|s)?)\b/giu,
  "sv-SE": /\b(?:webbplats(?:en|ens|er|erna|ernas)?|sajt(?:en|ens|er|erna)?|site(?:n|ns|r|rna|s)?)\b/giu,
  "da-DK": /\b(?:websted(?:et|ets|er|erne|ernes)?|site(?:t|ts|r|rne|s)?|sted(?:et|ets|er|erne|ernes)?)\b/giu,
  "fi-FI": /\b(?:sivusto(?:n|t|a|ja|jen|lla|lle|lta|ssa|sta|on|ksi|ineen)?|site(?:n|t|a|ja|lla|lle|ssa|sta)?)\b/giu,
  "de-DE": /\b(?:Website(?:n|s)?|Webseite(?:n|s)?|Standort(?:e|en|es|s)?)\b/giu,
  "fr-FR": /\bsites?\b/giu,
  "pl-PL": /\b(?:witryn\p{L}*|stron\p{L}*|stran\p{L}*)\b/giu,
  "es-ES": /\bsitios?\b/giu,
  "it-IT": /\bsit(?:o|i)\b/giu,
  "uk-UA": /(?<!\p{L})сайт\p{L}*(?!\p{L})/giu,
  "nl-NL": /\b(?:sites?|websites?)\b/giu,
  "pt-PT": /\b(?:sites?|sítios?)\b/giu,
  "cs-CZ": /\b(?:strán\p{L}*|webu|weby|webem)\b/giu,
  "ro-RO": /\bsite(?:-ul|-ului|-uri|-urile|-urilor)?\b/giu,
  "et-EE": /(?<!\p{L})(?:sait\p{L}*|said\p{L}*|veebileht\p{L}*|site)(?!\p{L})/giu,
  "lv-LV": /(?<!\p{L})vietn\p{L}*(?!\p{L})/giu,
  "lt-LT": /(?<!\p{L})(?:svetain\p{L}*|site)(?!\p{L})/giu,
};

const fallbackSiteForms: Record<string, RegExp> = {
  "sv-SE": /(?<!\p{L})(?:\p{L}*webbplats\p{L}*|plats\p{L}*)(?!\p{L})/iu,
  "da-DK": /(?<!\p{L})(?:\p{L}*sted\p{L}*|\p{L}*plads\p{L}*|omr\u00e5de\p{L}*|hjemmeside\p{L}*|lokalitet\p{L}*)(?!\p{L})/iu,
  "fi-FI": /(?<!\p{L})(?:\p{L}*paik\p{L}*|alue\p{L}*|toimipaik\p{L}*|työmaa\p{L}*)(?!\p{L})/iu,
  "de-DE": /(?<!\p{L})(?:Seit\p{L}*|Stell\p{L}*|Gelände\p{L}*)(?!\p{L})/iu,
  "fr-FR": /(?<!\p{L})lieu\p{L}*(?!\p{L})/iu,
  "pl-PL": /(?<!\p{L})(?:miejsc\p{L}*|obszar\p{L}*|obiekt\p{L}*)(?!\p{L})/iu,
  "es-ES": /(?<!\p{L})página\p{L}*(?!\p{L})/iu,
  "it-IT": /(?<!\p{L})(?:sito|siti)(?!\p{L})/iu,
  "uk-UA": /(?<!\p{L})(?:сайт\p{L}*|майданчик\p{L}*|ділян\p{L}*|територ\p{L}*)(?!\p{L})/iu,
  "nl-NL": /(?<!\p{L})(?:locati\p{L}*|plaats\p{L}*)(?!\p{L})/iu,
  "pt-PT": /(?<!\p{L})(?:loca(?:l|is|liza\p{L}*)|sítio\p{L}*)(?!\p{L})/iu,
  "cs-CZ": /(?<!\p{L})(?:míst\p{L}*|lokalit\p{L}*)(?!\p{L})/iu,
  "ro-RO": /(?<!\p{L})(?:sit\p{L}*|loc\p{L}*|șantier\p{L}*)(?!\p{L})/iu,
  "et-EE": /(?<!\p{L})(?:tegevuskoht\p{L}*|koht\p{L}*|objekt\p{L}*|ala\p{L}*|lehekülg\p{L}*|kodulehekülg\p{L}*)(?!\p{L})/iu,
  "lv-LV": /(?<!\p{L})(?:viet\p{L}*|objekt\p{L}*|būvlauk\p{L}*|teritor\p{L}*)(?!\p{L})/iu,
  "lt-LT": /(?<!\p{L})(?:viet\p{L}*|teritor\p{L}*)(?!\p{L})/iu,
};

function protect(value: string) {
  const segments: string[] = [];
  return {
    value: value.replace(protectedSegment, segment => {
      const index = segments.push(segment) - 1;
      return `\uE000${index}\uE001`;
    }),
    restore: (normalized: string) => normalized.replace(/\uE000(\d+)\uE001/g, (_, index: string) => segments[Number(index)] ?? ""),
  };
}

function sourceSiteNumber(source: string): "Site" | "Sites" | null {
  const comparable = source
    .replace(protectedSegment, "")
    .replace(/\bSite Managers?\b/g, "");
  if (/\bsites\b/i.test(comparable)) return "Sites";
  if (/\bsite(?:'s)?\b/i.test(comparable)) return "Site";
  return null;
}

export function normalizeReservedTerms(language: string, source: Catalog, catalog: Catalog): Catalog {
  const sitePattern = siteForms[language];
  if (!sitePattern) return catalog;

  return Object.fromEntries(Object.entries(catalog).map(([key, message]) => {
    const replacement = sourceSiteNumber(source[key as MessageKey]);
    if (!replacement) return [key, message];
    const protectedMessage = protect(message);
    let normalized = protectedMessage.value.replace(sitePattern, replacement);
    if (!new RegExp(`\\b${replacement}\\b`).test(normalized)) {
      const fallback = fallbackSiteForms[language];
      if (fallback) normalized = normalized.replace(fallback, replacement);
    }
    return [key, protectedMessage.restore(normalized)];
  })) as Catalog;
}
