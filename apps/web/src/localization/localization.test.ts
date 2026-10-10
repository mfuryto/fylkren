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
    expect(translate("en-US", "siteCatalogueUpdated")).toBe("The Site catalog was updated.");
    expect(translate("en-GB", "siteCatalogueUpdated")).toBe("The Site catalogue was updated.");
    expect(translate("en-US", "workflowsPlanningRfiLogNoInquiriesAreRegistered")).toBe("No inquiries are registered.");
    expect(translate("en-GB", "workflowsPlanningRfiLogNoInquiriesAreRegistered")).toBe("No enquiries are registered.");
    expect(translate("en-US", "taskStatusCancelled")).toBe("Canceled");
    expect(translate("en-GB", "taskStatusCancelled")).toBe("Cancelled");
  });

  it("uses British spelling throughout the United Kingdom catalog", () => {
    const americanForms = /\b(?:organization(?:al|s)?|authorization|authorized|authorize|synchroniz(?:e|ed|es|ing|ation)|catalog(?:s)?|colors?|colored|canceled|canceling|behavior(?:s)?|analyz(?:e|ed|es|ing)|prioritiz(?:e|ed|es|ing)|recogniz(?:able|e|ed|es|ing)|center(?:ed|s)?|artifacts?|enrollment|labeling|labeled|gray|defense|license)\b/i;
    for (const [key, message] of Object.entries(languageCatalogs["en-GB"])) {
      expect(message, `en-GB.${key} contains an American form`).not.toMatch(americanForms);
    }
    expect(translate("en-GB", "enterpriseRequired")).toBe("Requires an Enterprise licence");
    expect(translate("en-GB", "parentLeadershipUpdateFailed")).toBe("The authorisation could not be updated.");
    expect(translate("en-GB", "directorySyncFailed")).toBe("The directory users could not be synchronised.");
  });

  it("keeps Norwegian in its dedicated language pack", () => {
    expect(normalizeLanguage("nb-NO")).toBe("nb-NO");
    expect(translate("nb-NO", "regionalTitle")).not.toBe("Language and regional settings");
  });

  it("does not leave ordinary English interface wording in the Norwegian catalog", () => {
    const englishInterfaceWords = /\b(?:child|children|task|work|request|review|execution|planning|draft|unknown|failed|delete|save|open|close|selected|current|source|target|reason|description|title|owner|before|after|snapshots?|passkeys?|audit|entity|subject|authority|callback|module)\b/i;
    for (const [key, message] of Object.entries(languageCatalogs["nb-NO"])) {
      const withoutPlaceholders = message.replace(/\{\{?[A-Za-z][A-Za-z0-9]*\}?\}/g, "");
      expect(withoutPlaceholders, `nb-NO.${key} contains untranslated interface wording`).not.toMatch(englishInterfaceWords);
    }
  });

  it("does not leave English or translation artifacts in the reviewed Swedish catalog", () => {
    const allowedIdenticalKeys = new Set([
      "approvalStatus", "approvalVersion", "dayShort", "entitlementWebhooks", "entitySite", "entitySiteManager",
      "federationStatus", "imperial", "languageCzech", "languageDanish", "languageDutch", "languageEstonian",
      "languageFinnish", "languageFrench", "languageGerman", "languageItalian", "languageLatvian", "languageLithuanian",
      "languageNorwegian", "languagePolish", "languagePortuguese", "languageRomanian", "languageSpanish", "languageSwedish",
      "languageUkrainian", "minimal", "minuteShort", "navAi", "navApi", "navSites", "normalText", "planLabel", "port",
      "priorityNormal", "riskStatus", "site", "siteManagers", "sites", "tasksTaskCardPresentationRisk", "underSite",
      "underSiteUnit", "underUnit", "version", "versionLabel", "webhooks",
    ]);
    const artifacts = /avr\u00e4tt|exekv|regiss\u00f6r|funktionshindr|kundheml|kundnyck|sk\u00e5despel|migrations\u00e5tg\u00e4rd|mildrande|h\u00f6gh\u00f6g|totalt totalt|planplan|organisationsorganisation|arbetsf\u00f6rem\u00e5l|arbetsartikel|arbets-item|slgenomf\u00f6rande|(\p{L}+)(?:\s+\1){2,}/iu;
    for (const [key, message] of Object.entries(languageCatalogs["sv-SE"])) {
      expect(message, `sv-SE.${key} contains a translation artifact`).not.toMatch(artifacts);
      if (message === en[key as keyof typeof en]) expect(allowedIdenticalKeys.has(key), `sv-SE.${key} is untranslated`).toBe(true);
    }
  });

  it("does not leave English or translation artifacts in the reviewed Danish catalog", () => {
    const allowedIdenticalKeys = new Set([
      "actionStart", "aiModel", "approvalStatus", "approvalVersion", "baseDn", "dayShort", "entitlementWebhooks",
      "entitySite", "entitySiteManager", "federationStatus", "filter", "findPerson", "imperial", "languageCzech",
      "languageDanish", "languageDutch", "languageEstonian", "languageFinnish", "languageFrench", "languageGerman",
      "languageItalian", "languageLatvian", "languageLithuanian", "languageNorwegian", "languagePolish", "languagePortuguese",
      "languageRomanian", "languageSpanish", "languageSwedish", "languageUkrainian", "logo", "minimal", "minuteShort",
      "navAi", "navApi", "navPlatform", "navSites", "navigationMenu", "normalText", "planLabel", "platform",
      "platformScope", "port", "priorityNormal", "referenceLabel", "revision", "riskStatus", "runtimeDatabase", "site",
      "siteManagers", "sites", "taskTypeLabel", "testProvider", "underSite", "underSiteUnit", "underUnit", "version",
      "versionLabel", "webhooks",
    ]);
    const artifacts = /afsv\u00e6rt|opgavekype|opgasning|opl\u00f8bstal|mappelivecyklus|mappegender|platformh\u00e5ndtering|skuespiller|webkrog|forarbejdning|EU-varem\u00e6rke|QShortcut|\bsign-?\s*in\b|\bread-?\s*only\b|\bworkflow\b|\brationale\b|(\p{L}+)(?:\s+\1){2,}/iu;
    for (const [key, message] of Object.entries(languageCatalogs["da-DK"])) {
      const withoutPlaceholders = message.replace(/\{\{?[A-Za-z][A-Za-z0-9]*\}?\}/g, "");
      expect(withoutPlaceholders, `da-DK.${key} contains a translation artifact`).not.toMatch(artifacts);
      if (message === en[key as keyof typeof en]) expect(allowedIdenticalKeys.has(key), `da-DK.${key} is untranslated`).toBe(true);
    }
  });

  it("does not leave English or translation artifacts in the reviewed Finnish catalog", () => {
    const allowedIdenticalKeys = new Set([
      "entitySite", "entitySiteManager", "executionStepNameSuffix", "fylkrenSpEntityId", "hourShort",
      "languageCzech", "languageDanish", "languageDutch", "languageEstonian", "languageFinnish", "languageFrench",
      "languageGerman", "languageItalian", "languageLatvian", "languageLithuanian", "languageNorwegian",
      "languagePolish", "languagePortuguese", "languageRomanian", "languageSpanish", "languageSwedish",
      "languageUkrainian", "logo", "minuteShort", "navApi", "navPlatform", "navSites", "oidcSubject", "site",
      "siteManagers", "sites", "workflowNameSuffix",
    ]);
    const artifacts = /pelast|apurah|työmaa|liittoval|tuensaaj|ylivertai|työkappale|kansiotul|huipputaso|lapsipa|Läheinen tehtävä|ennätyksell|rationaalisuus|holdingin|Allocate-tehtävä|\bretries\b|\bAdd-\b|(?:\.\s*){6,}|(\p{L}+)(?:\s+\1){2,}/iu;
    for (const [key, message] of Object.entries(languageCatalogs["fi-FI"])) {
      const withoutPlaceholders = message.replace(/\{\{?[A-Za-z][A-Za-z0-9]*\}?\}/g, "");
      expect(withoutPlaceholders, `fi-FI.${key} contains a translation artifact`).not.toMatch(artifacts);
      if (message === en[key as keyof typeof en]) expect(allowedIdenticalKeys.has(key), `fi-FI.${key} is untranslated`).toBe(true);
    }
  });

  it("does not leave English or translation artifacts in the reviewed German catalog", () => {
    const allowedIdenticalKeys = new Set([
      "approvalStatus", "approvalVersion", "dayShort", "entitlementWebhooks", "entitySite", "entitySiteManager", "federationStatus",
      "filter", "hourShort", "imperial", "languageCzech", "languageDanish", "languageDutch", "languageEstonian",
      "languageFinnish", "languageFrench", "languageGerman", "languageItalian", "languageLatvian", "languageLithuanian",
      "languageNorwegian", "languagePolish", "languagePortuguese", "languageRomanian", "languageSpanish", "languageSwedish",
      "languageUkrainian", "logo", "minimal", "minuteShort", "name", "navApi", "navSites", "normalText", "planLabel",
      "port", "priorityNormal", "revision", "riskStatus", "site", "siteManagers", "sites", "sortNameAscending",
      "sortNameDescending", "version", "webhooks",
    ]);
    const artifacts = /Schauspieler|Schauspiel|Rettung|Schaffung|Streichung|Zuschuss|Bahnsteig|Mutterleiter|Mutterpläne|Arbeitsniveau|Arbeitsstufe|Veranstaltung|Kundengeheimnis|Kunden-ID|Hafen|Erfrischen des|\b(?:read-only|workflow|managed values|task chain|active processing|cancel editing|show plan)\b|(?:…\s*){2,}|(\p{L}+)(?:\s+\1){2,}/iu;
    for (const [key, message] of Object.entries(languageCatalogs["de-DE"])) {
      const withoutPlaceholders = message.replace(/\{\{?[A-Za-z][A-Za-z0-9]*\}?\}/g, "");
      expect(withoutPlaceholders, `de-DE.${key} contains a translation artifact`).not.toMatch(artifacts);
      if (message === en[key as keyof typeof en]) expect(allowedIdenticalKeys.has(key), `de-DE.${key} is untranslated`).toBe(true);
    }
  });

  it("does not leave English or translation artifacts in the reviewed French catalog", () => {
    const allowedIdenticalKeys = new Set([
      "actions", "aiQuestion", "aiRiskCause", "approvalDescription", "approvalDocument", "approvalVersion", "baseDn", "classifications",
      "dateLabel", "dayShort", "documentation", "entitlementWebhooks", "entitySite", "entitySiteManager", "hourShort",
      "languageCzech", "languageDanish", "languageDutch", "languageEstonian", "languageFinnish", "languageFrench",
      "languageGerman", "languageItalian", "languageLatvian", "languageLithuanian", "languageNorwegian", "languagePolish",
      "languagePortuguese", "languageRomanian", "languageSpanish", "languageSwedish", "languageUkrainian", "lifecycleAction",
      "logo", "message", "minimal", "minuteShort", "navApi", "navArchives", "navAudit", "navClassification",
      "navNotifications", "navPersonnel", "navSites", "navigationMenu", "normalText", "notifications", "organizationStructure",
      "personnel", "placement", "planLabel", "port", "priorityNormal", "riskCoordinates", "riskImpact", "site",
      "riskDescription", "siteManagers", "sites", "taskTypeLabel", "version", "versionLabel", "workflowsWorkflowsPageDirection",
    ]);
    const artifacts = /Commission|cessionnaire|réclamation|admissible|vers l'avenir|Exécution étroite|Nouvelle œuvre|subvention|ré-tér|Raccord d'essai|C'est fait|Site pour enfants|Désignation des marchandises|Réussi définitivement|\bfouillés\b|\bsnapshots?\b|\bworkflow\b|\bread-only\b|\bNo role\b|(?:…\s*){2,}/iu;
    for (const [key, message] of Object.entries(languageCatalogs["fr-FR"])) {
      const withoutPlaceholders = message.replace(/\{\{?[A-Za-z][A-Za-z0-9]*\}?\}/g, "");
      expect(withoutPlaceholders, `fr-FR.${key} contains a translation artifact`).not.toMatch(artifacts);
      if (message === en[key as keyof typeof en]) expect(allowedIdenticalKeys.has(key), `fr-FR.${key} is untranslated`).toBe(true);
    }
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

  it("keeps the selected translation catalog when the clock format extends the locale", () => {
    const swedishDisplayLocale = regionalDisplayLocale("sv-SE", "24-hour");
    const danishDisplayLocale = regionalDisplayLocale("da-DK", "12-hour");

    expect(normalizeLanguage(swedishDisplayLocale)).toBe("sv-SE");
    expect(normalizeLanguage(danishDisplayLocale)).toBe("da-DK");
    expect(translate(swedishDisplayLocale, "tasksTaskPageHeaderReceiptAssessmentAndFollowUpOf")).toBe(
      translate("sv-SE", "tasksTaskPageHeaderReceiptAssessmentAndFollowUpOf"),
    );
    expect(translate(danishDisplayLocale, "tasksTasksPageNoAvailableSites")).toBe(
      translate("da-DK", "tasksTasksPageNoAvailableSites"),
    );
    expect(translate(swedishDisplayLocale, "tasksTaskPageHeaderReceiptAssessmentAndFollowUpOf")).not.toBe(
      translate("en-US", "tasksTaskPageHeaderReceiptAssessmentAndFollowUpOf"),
    );
    expect(translate(danishDisplayLocale, "tasksTasksPageNoAvailableSites")).not.toBe(
      translate("en-US", "tasksTasksPageNoAvailableSites"),
    );
  });

  it("provides working date, number, plural and sorting behavior for every locale", () => {
    const instant = new Date("2026-10-01T18:30:00Z");
    for (const language of supportedLanguages) {
      const locale = regionalDisplayLocale(language, "24-hour");
      expect(normalizeLanguage(locale)).toBe(language);
      expect(translate(locale, "loading")).toBe(translate(language, "loading"));
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

  it("locks reviewed core actions, identity terms and measurement systems", () => {
    const expected = {
      "sv-SE": { loading: "Läser in…", singleSignOn: "Enkel inloggning", licensingAuthority: "Licensutfärdare", save: "Spara", cancel: "Avbryt", edit: "Redigera", delete: "Ta bort", metric: "Metrisk", imperial: "Imperial" },
      "da-DK": { loading: "Indl\u00e6ser...", singleSignOn: "Enkeltlogon", licensingAuthority: "Licensudsteder", save: "Gem", cancel: "Annullér", edit: "Redigér", delete: "Slet", metric: "Metrisk", imperial: "Imperial" },
      "fi-FI": { loading: "Ladataan...", singleSignOn: "Kertakirjautuminen", licensingAuthority: "Lisenssin myöntäjä", save: "Tallenna", cancel: "Peruuta", edit: "Muokkaa", delete: "Poista", metric: "Metrinen", imperial: "Brittiläinen mittajärjestelmä" },
      "de-DE": { loading: "Wird geladen…", singleSignOn: "Single Sign-on", licensingAuthority: "Lizenzgeber", save: "Speichern", cancel: "Abbrechen", edit: "Bearbeiten", delete: "Löschen", metric: "Metrisch", imperial: "Imperial" },
      "fr-FR": { loading: "Chargement...", singleSignOn: "Authentification unique", licensingAuthority: "Autorité de délivrance des licences", save: "Enregistrer", cancel: "Annuler", edit: "Modifier", delete: "Supprimer", metric: "Métrique", imperial: "Impérial" },
      "pl-PL": { loading: "Ładowanie...", singleSignOn: "Logowanie jednokrotne", licensingAuthority: "Organ wydający licencje", save: "Zapisz", cancel: "Anuluj", edit: "Edytuj", delete: "Usuń", metric: "Metryczny", imperial: "Imperialny" },
      "es-ES": { loading: "Cargando...", singleSignOn: "Inicio de sesión único", licensingAuthority: "Autoridad de concesión de licencias", save: "Guardar", cancel: "Cancelar", edit: "Editar", delete: "Eliminar", metric: "Métrico", imperial: "Imperial" },
      "it-IT": { loading: "Caricamento...", singleSignOn: "Accesso singolo", licensingAuthority: "Autorità di rilascio delle licenze", save: "Salva", cancel: "Annulla", edit: "Modifica", delete: "Cancella", metric: "Metrico", imperial: "Imperiale" },
      "uk-UA": { loading: "Завантаження…", singleSignOn: "Єдиний вхід", licensingAuthority: "Орган ліцензування", save: "Зберегти", cancel: "Скасувати", edit: "Редагувати", delete: "Видалити", metric: "Метрична система", imperial: "Імперська система" },
      "nl-NL": { loading: "Laden...", singleSignOn: "Eenmalige aanmelding", licensingAuthority: "Licentieautoriteit", save: "Opslaan", cancel: "Annuleren", edit: "Bewerken", delete: "Verwijderen", metric: "Metrisch", imperial: "Imperiaal" },
      "pt-PT": { loading: "A carregar…", singleSignOn: "Início de sessão único", licensingAuthority: "Autoridade de licenciamento", save: "Guardar", cancel: "Cancelar", edit: "Editar", delete: "Apagar", metric: "Métrico", imperial: "Imperial" },
      "cs-CZ": { loading: "Načítání…", singleSignOn: "Jednotné přihlášení", licensingAuthority: "Licenční autorita", save: "Uložit", cancel: "Zrušit", edit: "Upravit", delete: "Smazat", metric: "Metrický", imperial: "Imperiální" },
      "ro-RO": { loading: "Se încarcă...", singleSignOn: "Autentificare unică", licensingAuthority: "Autoritatea de licențiere", save: "Salvează", cancel: "Anulează", edit: "Editează", delete: "Șterge", metric: "Metric", imperial: "Imperial" },
      "et-EE": { loading: "Laadimine…", singleSignOn: "Ühekordne sisselogimine", licensingAuthority: "Litsentsi väljastaja", save: "Salvesta", cancel: "Tühista", edit: "Muuda", delete: "Kustuta", metric: "Meetermõõdustik", imperial: "Imperiaalne mõõdustik" },
      "lv-LV": { loading: "Ielāde…", singleSignOn: "Vienotā pierakstīšanās", licensingAuthority: "Licences izdevējs", save: "Saglabāt", cancel: "Atcelt", edit: "Rediģēt", delete: "Dzēst", metric: "Metriskā sistēma", imperial: "Imperiālā sistēma" },
      "lt-LT": { loading: "Įkeliama...", singleSignOn: "Bendrasis prisijungimas", licensingAuthority: "Licencijavimo institucija", save: "Išsaugoti", cancel: "Atšaukti", edit: "Redaguoti", delete: "Trinti", metric: "Metrinė sistema", imperial: "Imperinė sistema" },
    } as const;
    for (const [language, values] of Object.entries(expected)) {
      for (const [key, value] of Object.entries(values)) expect(translate(language, key as keyof typeof en)).toBe(value);
      expect(translate(language, "site")).toBe("Site");
      expect(translate(language, "sites")).toBe("Sites");
      expect(translate(language, "siteManagers")).toBe("Site Managers");
    }
  });

  it("locks reviewed Polish operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Wykonanie",
      workItemLabel: "Zadanie",
      riskImpact: "Konsekwencja",
      riskOwner: "Osoba odpowiedzialna",
      twoFactorAuthentication: "Uwierzytelnianie dwuskładnikowe",
      passkeys: "Klucze dostępu i klucze bezpieczeństwa",
      tasksTaskActionPanelsRouteOnward: "Przekaż dalej",
      workflowsPlanningDialogsNewResponsiblePlanner: "Nowy odpowiedzialny planista",
      auditLogLoadFailed: "Nie udało się wczytać dziennika audytu.",
      peersAndConnection: "Instalacje partnerskie i połączenia",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("pl-PL", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Spanish operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Ejecución",
      workItemLabel: "Tarea",
      riskImpact: "Consecuencia",
      riskOwner: "Responsable",
      twoFactorAuthentication: "Autenticación de dos factores",
      passkeys: "Claves de acceso y llaves de seguridad",
      tasksTaskActionPanelsRouteOnward: "Encaminar",
      workflowsPlanningDialogsNewResponsiblePlanner: "Nuevo planificador responsable",
      auditLogLoadFailed: "No se pudo cargar el registro de auditoría.",
      peersAndConnection: "Instalaciones asociadas y conexión",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("es-ES", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Italian operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Esecuzione",
      workItemLabel: "Attività",
      riskImpact: "Conseguenza",
      riskOwner: "Responsabile",
      twoFactorAuthentication: "Autenticazione a due fattori",
      passkeys: "Chiavi di accesso e chiavi di sicurezza",
      tasksTaskActionPanelsRouteOnward: "Instrada",
      workflowsPlanningDialogsNewResponsiblePlanner: "Nuovo pianificatore responsabile",
      auditLogLoadFailed: "Impossibile caricare il registro di audit.",
      peersAndConnection: "Installazioni associate e connessione",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("it-IT", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Ukrainian operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Виконання",
      workItemLabel: "Завдання",
      riskImpact: "Наслідок",
      riskOwner: "Відповідальний",
      twoFactorAuthentication: "Двофакторна автентифікація",
      passkeys: "Ключі доступу та ключі безпеки",
      tasksTaskActionPanelsRouteOnward: "Передати далі",
      workflowsPlanningDialogsNewResponsiblePlanner: "Новий відповідальний планувальник",
      auditLogLoadFailed: "Не вдалося завантажити журнал аудиту.",
      peersAndConnection: "Пов’язані інсталяції та з’єднання",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("uk-UA", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Dutch operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Uitvoering",
      workItemLabel: "Werkitem",
      riskImpact: "Gevolg",
      riskOwner: "Verantwoordelijke",
      twoFactorAuthentication: "Tweefactorauthenticatie",
      passkeys: "Toegangssleutels en beveiligingssleutels",
      tasksTaskActionPanelsRouteOnward: "Doorsturen",
      workflowsPlanningDialogsNewResponsiblePlanner: "Nieuwe verantwoordelijke planner",
      auditLogLoadFailed: "Het auditlogboek kon niet geladen worden.",
      peersAndConnection: "Gekoppelde installaties en verbinding",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("nl-NL", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed European Portuguese operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Execução",
      workItemLabel: "Item de trabalho",
      riskImpact: "Impacto",
      riskOwner: "Responsável",
      twoFactorAuthentication: "Autenticação de dois fatores",
      passkeys: "Chaves de acesso e chaves de segurança",
      tasksTaskActionPanelsRouteOnward: "Reencaminhar",
      workflowsPlanningDialogsNewResponsiblePlanner: "Novo responsável pelo planeamento",
      auditLogLoadFailed: "O registo de auditoria não pôde ser carregado.",
      peersAndConnection: "Instalações associadas e ligação",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("pt-PT", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Czech operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Realizace",
      workItemLabel: "Pracovní položka",
      riskImpact: "Dopad",
      riskOwner: "Odpovědná osoba",
      twoFactorAuthentication: "Dvoufaktorové ověřování",
      passkeys: "Přístupové klíče a bezpečnostní klíče",
      tasksTaskActionPanelsRouteOnward: "Předat dál",
      workflowsPlanningDialogsNewResponsiblePlanner: "Nový odpovědný plánovač",
      auditLogLoadFailed: "Protokol auditu se nepodařilo načíst.",
      peersAndConnection: "Propojené instalace a připojení",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("cs-CZ", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Romanian operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Execuția",
      workItemLabel: "Element de lucru",
      riskImpact: "Impact",
      riskOwner: "Responsabil",
      twoFactorAuthentication: "Autentificare cu doi factori",
      passkeys: "Chei de acces și chei de securitate",
      tasksTaskActionPanelsRouteOnward: "Transmite mai departe",
      workflowsPlanningDialogsNewResponsiblePlanner: "Noul planificator responsabil",
      auditLogLoadFailed: "Jurnalul de audit nu a putut fi încărcat.",
      peersAndConnection: "Instalări asociate și conexiune",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("ro-RO", key as keyof typeof en)).toBe(value);
    }
  });

  it("locks reviewed Estonian operational and security terminology", () => {
    const expected = {
      taskStatusExecution: "Teostamine",
      workItemLabel: "Tööülesanne",
      riskImpact: "Mõju",
      riskOwner: "Vastutaja",
      twoFactorAuthentication: "Kaheastmeline autentimine",
      passkeys: "Pääsuvõtmed ja turvavõtmed",
      tasksTaskActionPanelsRouteOnward: "Edasta edasi",
      workflowsPlanningDialogsNewResponsiblePlanner: "Uus vastutav planeerija",
      auditLogLoadFailed: "Auditi logi laadimine nurjus.",
      peersAndConnection: "Seotud paigaldused ja ühendus",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      expect(translate("et-EE", key as keyof typeof en)).toBe(value);
    }
  });

  it("rejects translation-tool artifacts and control characters", () => {
    const artifact = /NAME OF TRANSLATORS|@\s*info|whatsthis|STARTLS|TIRPIK|\bNPI\b|Nelegalus|Toksiškumas|Locale locale|Nessun segnale locale|(?:\.\s*){8,}|(?:•\s*){12,}|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/i;
    for (const language of supportedLanguages) {
      for (const message of Object.values(languageCatalogs[language])) expect(message).not.toMatch(artifact);
    }
  });

  it("does not silently retain substantial English interface text", () => {
    const allowedIdenticalMessages = new Set([
      "fylkrenSpEntityId",
      "languagePortuguese",
      "oidcSubject",
      "revision",
      "underSiteUnit",
      "versionLabel",
      "workflowsWorkflowFieldsHttpsFileOrSmb",
    ]);
    for (const language of supportedLanguages.filter(language => !["en-US", "en-GB"].includes(language))) {
      for (const [key, message] of Object.entries(languageCatalogs[language])) {
        if (message.length >= 18 && message === en[key as keyof typeof en]) {
          expect(allowedIdenticalMessages, `${language}.${key} is still English`).toContain(key);
        }
      }
    }
  });

  it("preserves protocol names, API paths, headers and permission scopes", () => {
    const protectedTokens = [
      "/api/v1/administration/sites",
      "classifications:read",
      "classifications:write",
      "Idempotency-Key",
      "If-Match",
      "reports:read",
      "STARTTLS",
      "WebAuthn",
      "HTTPS",
      "SMTP",
      "SAML",
      "OIDC",
      "LDAP",
      "SCIM",
      "ETag",
      "UTC",
      "API",
    ];
    for (const language of supportedLanguages) {
      for (const [key, source] of Object.entries(en)) {
        for (const token of protectedTokens.filter(candidate => source.includes(candidate))) {
          expect(languageCatalogs[language][key as keyof typeof en], `${language}.${key} must preserve ${token}`).toContain(token);
        }
      }
    }
  });

  it("keeps Site terminology invariant in every translated interface sentence", () => {
    const withoutTechnicalSegments = (message: string) => message
      .replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "")
      .replace(/\/[^\s,.;)]+/g, "")
      .replace(/\bSite Managers?\b/g, "");

    for (const language of supportedLanguages) {
      for (const [key, sourceMessage] of Object.entries(en)) {
        const source = withoutTechnicalSegments(sourceMessage);
        const translated = withoutTechnicalSegments(languageCatalogs[language][key as keyof typeof en]);
        if (/\bsites\b/i.test(source)) expect(translated, `${language}.${key} must use Sites`).toMatch(/\bSites\b/);
        else if (/\bsite(?:'s)?\b/i.test(source)) expect(translated, `${language}.${key} must use Site`).toMatch(/\bSite\b/);
      }
    }
  });
});
