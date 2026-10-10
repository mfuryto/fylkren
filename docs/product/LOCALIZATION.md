# Localization and language packs

Fylkren separates repository language from product language. Source code, identifiers, tests, examples and maintained documentation are written in English. User-visible product text is resolved through bundled language catalogs and does not require an Internet service.

The [localization terminology](LOCALIZATION_TERMINOLOGY.md) is authoritative for reserved product names, domain concepts and security-sensitive actions.

## Current language roster

| Locale | Language | Status |
| --- | --- | --- |
| `en-US` | English (United States) | Source catalog and mandatory fallback |
| `en-GB` | English (United Kingdom) | Complete derived regional catalog |
| `nb-NO` | Norwegian Bokmal | Complete derived catalog |
| `sv-SE` | Swedish | Complete derived catalog |
| `da-DK` | Danish | Complete derived catalog |
| `fi-FI` | Finnish | Complete derived catalog |
| `de-DE` | German | Complete derived catalog |
| `fr-FR` | French | Complete derived catalog |
| `pl-PL` | Polish | Complete derived catalog |
| `es-ES` | Spanish (Spain) | Complete derived catalog |
| `it-IT` | Italian | Complete derived catalog |
| `uk-UA` | Ukrainian | Complete derived catalog |
| `nl-NL` | Dutch | Complete derived catalog |
| `pt-PT` | Portuguese (Portugal) | Complete derived catalog |
| `cs-CZ` | Czech | Complete derived catalog |
| `ro-RO` | Romanian | Complete derived catalog |
| `et-EE` | Estonian | Complete derived catalog |
| `lv-LV` | Latvian | Complete derived catalog |
| `lt-LT` | Lithuanian | Complete derived catalog |

The legacy locale value `en` is treated as `en-US` and upgraded to that explicit value. No additional locale is considered supported until its complete bundled catalog, locale behavior, documentation and automated tests are delivered together.

## Language model

American English (`en-US`) is the authoritative semantic source for interface text, catalog keys and fallback behavior. Every other locale in the roster is a complete derived language pack and is technically complete and selectable. Linguistic assurance follows the automated quality gate below rather than a requirement to recruit a reviewer for every language.

Locales outside the maintained roster are unsupported. Regional variants such as Brazilian Portuguese, Canadian French or Latin American Spanish require an explicit product decision and a complete catalog rather than silently reusing another region's pack.

## Mandatory change rule

Every change that adds, removes or changes user-visible text must update the English source catalog and every complete bundled language pack in the same commit. This includes navigation, controls, validation, errors, accessibility labels, help, email templates, reports, print/PDF output and authentication text. A feature is not complete when one supported language still shows an old label, a raw identifier or fallback text unintentionally.

The catalog registry is typed against the English source keys. Automated tests verify that every registered pack has exactly the source keys and the same interpolation placeholders. Adding a locale to the supported-language registry therefore requires a complete catalog rather than a partial runtime pack.

## Automated linguistic quality gate

Catalog completeness is not evidence that a translation is correct. Before a locale is described as linguistically verified, the fixed product interface catalog must pass a reproducible report containing:

1. terminology checks against a version-controlled term base for security, identity, federation, workflow, task, report and licensing concepts;
2. independent comparison with at least two maintained translation engines, using authenticated APIs rather than browser-page scraping;
3. back-translation and semantic disagreement flags for security-sensitive, destructive, entitlement, status and workflow-transition text;
4. spelling, grammar and style checks through a maintained language-specific engine where available, with dictionaries or another documented checker for languages it does not cover;
5. source-language leakage, wrong-language, untranslated-fragment, control-character, punctuation, placeholder and markup checks;
6. browser rendering at maintained desktop and mobile widths, including clipped controls, overflow, dialogs, email, reports and PDF output;
7. the existing locale behavior, catalog parity, typecheck, build and automated regression suites.

The report records catalog hashes, provider/model versions, date, findings and resolved exceptions. Translation provider credentials are never committed. Only fixed Fylkren interface text may be submitted; customer content, deployment configuration and operational data are out of scope. A provider suggestion is evidence for review, not an automatic overwrite. Material disagreement between engines blocks the locale until the term base or translation is corrected.

English and Norwegian may additionally be owner-reviewed, but public support for the remaining roster does not depend on recruiting individual native-language reviewers. Release notes state the automated assurance method without implying human certification that did not occur.

## Locale behavior

- American English (`en-US`) is used for unknown or unsupported locale values.
- Platform Manager selects the default GUI language, IANA time zone, 12/24-hour clock and measurement system under **Appearance**.
- Dates, times, numbers, plural forms and sorting use the configured locale behavior.
- Routes, API contracts, database identifiers, audit event types and permalinks remain language-neutral.
- Site names, personal names, customer content, historical snapshots and customer-managed classification definitions are not automatically translated.
- Every language resource ships with the application and remains available in air-gapped installations.

## Adding a language

Adding a supported language requires all of the following in one maintained change set:

1. a complete catalog registered under a valid BCP 47 locale;
2. a native-language name in the Platform Manager language selector;
3. matching placeholders and coverage for all English source keys;
4. locale-specific date, time, number, plural, sorting and layout tests;
5. review of longer labels, right-to-left layout where relevant, accessibility text, email, reports and PDF output;
6. a recorded automated linguistic-quality report with no unresolved blocking findings;
7. updated README language roster, user manual and release notes.

Language resources follow the maintained structure under `apps/web/src/localization/catalogs/<locale>/`. Shared localization code must not be mixed into a language directory, and a planned language must not be represented by a partial placeholder pack.

Machine-generated translation may assist drafting. Support requires the complete automated linguistic and technical acceptance suite, retained evidence and resolution of blocking findings; one engine's output alone is never sufficient.
